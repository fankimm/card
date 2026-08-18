// 서명 쿠키 기반 세션.
//
// 이 앱은 지금까지 신원을 쿼리 파라미터로만 받았다. 즉 ?name=아무개&card=1234 만
// 알면 남의 이용내역·출근일·제외설정을 그대로 볼 수 있었다. 서버가 신원을 직접
// 확인하도록 로그인 시 서명 쿠키를 발급하고, 데이터 API는 그 쿠키만 믿는다.
//
// SESSION_SECRET 이 없으면 서명을 만들 수 없으므로 세션 기능을 끈다.
// 그때는 예전처럼 쿼리 파라미터로 동작한다 — 환경변수를 채우는 순간부터 조여진다.
import crypto from 'crypto';

export interface Session {
  name: string;
  cards: string[];
  /** 발급 시각(초). 만료 판정에 쓴다. */
  iat: number;
}

export const COOKIE_NAME = 'cu_session';
const MAX_AGE_SEC = 180 * 24 * 60 * 60; // 180일

export const 세션사용가능 = () => !!process.env.SESSION_SECRET;

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64url');

const sign = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64url');

export const 세션발급 = (name: string, cards: string[]): string | null => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const body: Session = {
    name,
    cards,
    iat: Math.floor(Date.now() / 1000),
  };
  const payload = b64u(JSON.stringify(body));
  return `${payload}.${sign(payload, secret)}`;
};

export const 세션읽기 = (token?: string): Session | null => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;

  const expected = sign(payload, secret);
  // 길이가 다르면 timingSafeEqual 이 던진다. 먼저 걸러낸다.
  if (mac.length !== expected.length) return null;
  if (
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const body = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as Session;
    if (!body?.name || !Array.isArray(body.cards)) return null;
    if (Math.floor(Date.now() / 1000) - (body.iat || 0) > MAX_AGE_SEC) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
};

export const 쿠키만들기 = (token: string) =>
  [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SEC}`,
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

export const 쿠키지우기 = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
