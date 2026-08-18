import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { 서울시각, 예약에러찾기 } from '../../pages/api/pick-seat';

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
  // dayjs(헤더).hour() 는 6을 돌려준다(Vercel=UTC).
  it('GMT 헤더를 서울 기준 시로 읽는다', () => {
    const t = 서울시각('Tue, 18 Aug 2026 06:57:37 GMT');
    expect(t.hour()).toBe(15);
    expect(t.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-08-18 15:57:37');
  });

  // 좌석은 자정에 열리고 단축어도 그때 부른다. 자정 KST = 전날 UTC 15시라,
  // 시각으로 실행을 막는 조건을 두면 여기서 걸린다. 그래서 조건 자체를 걷어냈다.
  it('자정 실행 시각을 KST 0시로 읽는다', () => {
    const 자정 = 서울시각('Mon, 17 Aug 2026 15:00:00 GMT');
    expect(자정.hour()).toBe(0);
    expect(자정.format('YYYY-MM-DD HH:mm')).toBe('2026-08-18 00:00');
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

describe('예약에러찾기', () => {
  // 2026-08-18 실제 응답. HTTP 200 인데 본문에 에러가 담겨 온다.
  it('배치 응답 안의 에러를 꺼낸다', () => {
    const 실제응답 = [
      {
        error: {
          message: '[GraphQL] 이미 예약된 좌석입니다.',
          code: -32603,
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: 'checkIn' },
        },
      },
    ];
    expect(예약에러찾기(실제응답)).toBe('이미 예약된 좌석입니다.');
  });

  it('성공 응답이면 null', () => {
    expect(예약에러찾기([{ result: { data: { id: 1 } } }])).toBeNull();
    expect(예약에러찾기([])).toBeNull();
    expect(예약에러찾기(null)).toBeNull();
  });
});
