import { afterEach, describe, expect, it } from 'vitest';
import { 세션발급, 세션읽기, 세션사용가능, 쿠키만들기 } from '../session';

const 원래 = process.env.SESSION_SECRET;
afterEach(() => {
  if (원래 === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = 원래;
});

describe('SESSION_SECRET 이 없을 때', () => {
  it('세션 기능이 꺼진다 (기존 쿼리 파라미터 동작 유지)', () => {
    delete process.env.SESSION_SECRET;
    expect(세션사용가능()).toBe(false);
    expect(세션발급('김지환', ['9427'])).toBeNull();
    expect(세션읽기('아무거나')).toBeNull();
  });
});

describe('SESSION_SECRET 이 있을 때', () => {
  const 준비 = () => {
    process.env.SESSION_SECRET = 'test-secret-0123456789';
  };

  it('발급한 토큰을 그대로 읽는다', () => {
    준비();
    const token = 세션발급('김지환', ['9427', '8713'])!;
    const s = 세션읽기(token);
    expect(s?.name).toBe('김지환');
    expect(s?.cards).toEqual(['9427', '8713']);
  });

  it('페이로드를 조작하면 거부한다', () => {
    준비();
    const token = 세션발급('김지환', ['9427'])!;
    const [payload, mac] = token.split('.');
    const 조작 = Buffer.from(
      JSON.stringify({ name: '홍동수', cards: ['6522'], iat: Math.floor(Date.now() / 1000) })
    ).toString('base64url');
    expect(세션읽기(`${조작}.${mac}`)).toBeNull();
  });

  it('다른 키로 서명한 토큰은 거부한다', () => {
    준비();
    const token = 세션발급('김지환', ['9427'])!;
    process.env.SESSION_SECRET = '다른-키';
    expect(세션읽기(token)).toBeNull();
  });

  it('망가진 토큰도 던지지 않고 null', () => {
    준비();
    expect(세션읽기('')).toBeNull();
    expect(세션읽기('점없음')).toBeNull();
    expect(세션읽기('a.b')).toBeNull();
    expect(세션읽기(undefined)).toBeNull();
  });

  it('오래된 토큰은 만료시킨다', () => {
    준비();
    const token = 세션발급('김지환', ['9427'])!;
    const [payload] = token.split('.');
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    body.iat = Math.floor(Date.now() / 1000) - 181 * 24 * 60 * 60;
    // 만료된 페이로드를 같은 키로 정상 서명해도 거부되어야 한다
    const crypto = require('crypto');
    const p2 = Buffer.from(JSON.stringify(body)).toString('base64url');
    const mac2 = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update(p2)
      .digest('base64url');
    expect(세션읽기(`${p2}.${mac2}`)).toBeNull();
  });

  it('쿠키는 HttpOnly / SameSite 를 단다', () => {
    준비();
    const c = 쿠키만들기('t');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
  });
});
