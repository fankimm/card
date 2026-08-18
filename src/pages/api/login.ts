// 로그인 검증 API.
//
// 예전에는 클라이언트가 전체 내역을 받아 이름·카드번호를 직접 대조했다.
// 그러려면 전원의 이름과 카드 뒷 4자리를 내려줘야 하는데, 그 둘이 곧 로그인 수단이라
// 대조에 쓸 정답을 먼저 나눠주는 꼴이었다. 이제 대조는 여기서 하고 결과만 내보낸다.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getData, 내카드확정 } from './get-total-fee';
import { isMaskedNameMatch } from '../../lib/user-match';
import { 세션발급, 쿠키만들기 } from '../../lib/session';

// 검증을 통과하면 서명 쿠키를 심는다. 이후 데이터 API는 쿼리 파라미터 대신
// 이 쿠키로 신원을 판단한다. SESSION_SECRET 이 없으면 발급하지 않는다.
const 세션심기 = (res: NextApiResponse, name: string, cards: string[]) => {
  const token = 세션발급(name, cards);
  if (token) res.setHeader('Set-Cookie', 쿠키만들기(token));
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }

  const name = String(req.body?.name ?? '').trim();
  const card = String(req.body?.card ?? '').trim();
  if (!name) {
    res.status(400).json({ ok: false, message: '이름을 입력해주세요.' });
    return;
  }
  if (!/^\d{4}$/.test(card)) {
    res
      .status(400)
      .json({ ok: false, message: '카드 뒷 4자리를 정확히 입력해주세요.' });
    return;
  }

  let all;
  try {
    all = await getData();
  } catch {
    // 시트가 잠깐 죽었다고 로그인까지 막지는 않는다(기존 동작 유지).
    세션심기(res, name, [card]);
    res.status(200).json({ ok: true, cards: [card], verified: false });
    return;
  }

  const 이카드내역 = all.filter(
    (i) => String(i.cardNumber || '').trim() === card
  );
  if (
    이카드내역.length > 0 &&
    !이카드내역.some((i) => isMaskedNameMatch(i.user, name))
  ) {
    res
      .status(200)
      .json({ ok: false, message: '이름과 카드 번호가 일치하지 않아요.' });
    return;
  }

  const cards = 내카드확정(all, name, card);
  세션심기(res, name, cards);
  res.status(200).json({ ok: true, cards, verified: true });
}
