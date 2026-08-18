// 데이터 API가 "누가 물어보는지"를 정하는 한 곳.
//
// SESSION_SECRET 이 설정돼 있으면 서명 쿠키만 믿는다(쿼리 파라미터는 무시).
// 설정 전에는 예전처럼 쿼리 파라미터를 쓴다 — 환경변수를 채우는 순간 조여진다.
import type { NextApiRequest, NextApiResponse } from 'next';
import { COOKIE_NAME, 세션사용가능, 세션읽기 } from './session';

export interface 요청자정보 {
  name: string;
  /** 콤마로 이어붙인 카드 뒷 4자리. 맨 앞이 현재 카드. */
  card: string;
}

export const 요청자 = (req: NextApiRequest): 요청자정보 | null => {
  if (세션사용가능()) {
    const s = 세션읽기(req.cookies?.[COOKIE_NAME]);
    return s ? { name: s.name, card: s.cards.join(',') } : null;
  }
  const name = ((req.query.name as string) || '').trim();
  if (!name) return null;
  return { name, card: ((req.query.card as string) || '').trim() };
};

/**
 * 요청자를 구하고, 없으면 알맞은 응답을 보낸 뒤 null 을 돌려준다.
 * 세션이 켜져 있는데 쿠키가 없으면 401 — 클라이언트는 이걸 보고 로그인으로 보낸다.
 */
export const 요청자확인 = (
  req: NextApiRequest,
  res: NextApiResponse
): 요청자정보 | null => {
  const who = 요청자(req);
  if (who) return who;
  if (세션사용가능()) {
    res.status(401).json({ message: '로그인이 필요합니다' });
  } else {
    res.status(400).json({ message: 'name 이 필요합니다' });
  }
  return null;
};
