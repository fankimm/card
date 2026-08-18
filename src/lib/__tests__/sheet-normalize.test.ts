import { describe, expect, it } from 'vitest';
import { 날짜정규화, 시각정규화, 행정규화 } from '../sheet-normalize';

// 프로덕션에서 실제로 받은 모양. 시트 셀은 멀쩡한데 Apps Script가 Date 원문을 흘렸다.
const 실제날짜 = 'Wed Aug 05 2026 00:00:00 GMT+0900 (한국 표준시)';
const 실제시각 = 'Sat Dec 30 1899 12:11:00 GMT+0827 (한국 표준시)';

describe('날짜정규화', () => {
  it('Date 원문을 YYYY-MM-DD 로 되돌린다', () => {
    expect(날짜정규화(실제날짜)).toBe('2026-08-05');
  });

  // Vercel은 UTC로 돈다. 자정+KST라서 UTC로 찍으면 전 날짜가 하루씩 밀린다.
  it('프로세스 타임존과 무관하게 서울 기준으로 찍는다', () => {
    const 원래 = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      expect(날짜정규화('Thu Jan 01 2026 00:00:00 GMT+0900 (한국 표준시)')).toBe(
        '2026-01-01'
      );
      expect(날짜정규화(실제날짜)).toBe('2026-08-05');
    } finally {
      process.env.TZ = 원래;
    }
  });

  it('이미 올바른 값은 건드리지 않는다', () => {
    expect(날짜정규화('2026-08-05')).toBe('2026-08-05');
    expect(날짜정규화('')).toBe('');
  });

  it('해석 못 하는 값은 그대로 둔다', () => {
    expect(날짜정규화('아무말')).toBe('아무말');
  });
});

describe('시각정규화', () => {
  it('1899년 기준 Date 원문에서 벽시계 시각을 뽑는다', () => {
    // Date로 파싱하면 지방시(+08:27) 때문에 27분 밀린다. 문자열에서 직접 뽑아야 한다.
    expect(시각정규화(실제시각)).toBe('12:11:00');
  });

  it('이미 올바른 값은 건드리지 않는다', () => {
    expect(시각정규화('12:11:00')).toBe('12:11:00');
    expect(시각정규화('9:21')).toBe('9:21');
    expect(시각정규화('')).toBe('');
  });

  it('한 자리 시는 0을 채운다', () => {
    expect(시각정규화('Sat Dec 30 1899 9:21:00 GMT+0827')).toBe('09:21:00');
  });
});

describe('행정규화', () => {
  it('date/time 만 바꾸고 나머지 필드는 보존한다', () => {
    const [out] = 행정규화([
      {
        id: '896',
        date: 실제날짜,
        time: 실제시각,
        fee: '13000',
        place: '산호골',
      } as any,
    ]);
    expect(out).toMatchObject({
      id: '896',
      date: '2026-08-05',
      time: '12:11:00',
      fee: '13000',
      place: '산호골',
    });
  });
});
