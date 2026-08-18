import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  서울시각,
  예약에러찾기,
  자정까지남은ms,
} from '../../pages/api/pick-seat';

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

describe('자정까지남은ms', () => {
  it('자정 직전이면 넘어갈 때까지의 시간을 돌려준다', () => {
    // 서버가 KST 23:59:57 (= UTC 14:59:57)
    const t = 서울시각('Mon, 17 Aug 2026 14:59:57 GMT');
    expect(t.format('HH:mm:ss')).toBe('23:59:57');
    const ms = 자정까지남은ms(t, 8000);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(4000);
  });

  it('이미 자정을 넘겼으면 기다리지 않는다', () => {
    // 서버가 KST 00:00:02
    const t = 서울시각('Mon, 17 Aug 2026 15:00:02 GMT');
    expect(t.format('HH:mm:ss')).toBe('00:00:02');
    expect(자정까지남은ms(t, 8000)).toBe(0);
  });

  it('자정이 한참 남았으면(낮에 수동 호출) 기다리지 않고 진행한다', () => {
    const t = 서울시각('Tue, 18 Aug 2026 06:57:37 GMT'); // KST 15:57
    expect(자정까지남은ms(t, 8000)).toBe(0);
  });

  it('상한을 넘으면 기다리지 않는다', () => {
    const t = 서울시각('Mon, 17 Aug 2026 14:59:50 GMT'); // 자정까지 10초
    expect(자정까지남은ms(t, 8000)).toBe(0);
    expect(자정까지남은ms(t, 15000)).toBeGreaterThan(9000);
  });
});
