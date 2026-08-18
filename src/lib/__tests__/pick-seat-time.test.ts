import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { 서울시각 } from '../../pages/api/pick-seat';

// Vercel은 UTC로 돈다. 개발 맥은 Asia/Seoul 이라 이 차이가 로컬에서는 안 드러난다.
const 원래TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'UTC';
});
afterAll(() => {
  process.env.TZ = 원래TZ;
});

describe('서울시각', () => {
  // 2026-08-18 프로덕션에서 실제로 받은 헤더. 한국은 15:57 인데
  // dayjs(헤더).hour() 가 6을 돌려줘서 "12시 이후" 조건이 계속 막고 있었다.
  it('GMT 헤더를 서울 기준 시로 읽는다', () => {
    const t = 서울시각('Tue, 18 Aug 2026 06:57:37 GMT');
    expect(t.hour()).toBe(15);
    expect(t.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-08-18 15:57:37');
  });

  it('점심시간대 실행 조건(12시 이후)이 KST 기준으로 판정된다', () => {
    // KST 12:30 = UTC 03:30 — 예전 코드는 3 < 12 라 실행을 막았다
    expect(서울시각('Tue, 18 Aug 2026 03:30:00 GMT').hour()).toBe(12);
    expect(서울시각('Tue, 18 Aug 2026 03:30:00 GMT').hour() < 12).toBe(false);

    // KST 09:00 = UTC 00:00 — 이건 실제로 막혀야 한다
    expect(서울시각('Tue, 18 Aug 2026 00:00:00 GMT').hour()).toBe(9);
    expect(서울시각('Tue, 18 Aug 2026 00:00:00 GMT').hour() < 12).toBe(true);
  });

  it('날짜 경계도 서울 기준으로 넘어간다', () => {
    // UTC 2026-08-17 15:30 = KST 2026-08-18 00:30
    expect(서울시각('Mon, 17 Aug 2026 15:30:00 GMT').format('YYYY-MM-DD')).toBe(
      '2026-08-18'
    );
  });

  it('헤더가 없어도 던지지 않는다', () => {
    expect(서울시각(null).isValid()).toBe(true);
  });
});
