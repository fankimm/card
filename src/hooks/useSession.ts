// 로그인 정보를 다루는 한 곳.
//
// 예전엔 window.localStorage.getItem('loginInfo') 가 화면 곳곳(렌더 본문·useMemo·
// 이벤트 핸들러)에 20군데 넘게 흩어져 있었다. 어디서 바뀌는지 추적이 안 되고,
// SSR 가드(typeof window !== 'undefined')도 매번 손으로 붙여야 했다.
import { useCallback, useEffect, useState } from 'react';
import { 카드목록파싱 } from '../lib/user-match';

const 이름키 = 'loginInfo';
const 카드키 = 'cardInfo';
export const 캐시키 = (name: string) => `card-usages:${name}:v2`;

export interface SessionState {
  /** 로그인한 사람 이름. 비로그인이면 null. */
  name: string | null;
  /** 콤마로 이어붙인 카드 뒷 4자리. 맨 앞이 현재 카드. */
  card: string | null;
}

const 읽기 = (): SessionState => {
  if (typeof window === 'undefined') return { name: null, card: null };
  try {
    return {
      name: window.localStorage.getItem(이름키),
      card: window.localStorage.getItem(카드키),
    };
  } catch {
    return { name: null, card: null };
  }
};

export const useSession = () => {
  // 서버 렌더와 첫 클라이언트 렌더를 맞추기 위해 비로그인으로 시작하고,
  // 마운트 후에 실제 값을 읽는다.
  const [session, setSession] = useState<SessionState>({
    name: null,
    card: null,
  });
  const [준비됨, set준비됨] = useState(false);

  useEffect(() => {
    setSession(읽기());
    set준비됨(true);
  }, []);

  // 로그인 화면이 window 이벤트로 알려준다(라우팅으로 넘어오기 때문에)
  useEffect(() => {
    const onLogin = () => setSession(읽기());
    window.addEventListener('login', onLogin);
    return () => window.removeEventListener('login', onLogin);
  }, []);

  const 카드저장 = useCallback((cards: string[] | string) => {
    const v = Array.isArray(cards) ? cards.join(',') : cards;
    try {
      window.localStorage.setItem(카드키, v);
    } catch {}
    setSession((p) => ({ ...p, card: v }));
  }, []);

  const 로그아웃 = useCallback(() => {
    try {
      const name = window.localStorage.getItem(이름키);
      window.localStorage.removeItem(이름키);
      window.localStorage.removeItem(카드키);
      if (name) window.localStorage.removeItem(캐시키(name));
    } catch {}
    setSession({ name: null, card: null });
  }, []);

  return {
    ...session,
    준비됨,
    로그인됨: !!session.name,
    카드목록: 카드목록파싱(session.card),
    카드저장,
    로그아웃,
  };
};
