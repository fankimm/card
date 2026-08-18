import { describe, expect, it } from 'vitest';
import {
  isMaskedNameMatch,
  isSameUser,
  카드목록파싱,
  재발급카드찾기,
} from '../user-match';

describe('isMaskedNameMatch', () => {
  it('마스킹 자리는 아무 글자나 허용한다', () => {
    expect(isMaskedNameMatch('김지환', '김*환')).toBe(true);
    expect(isMaskedNameMatch('김*환', '김지환')).toBe(true);
    expect(isMaskedNameMatch('홍*수', '홍동수')).toBe(true);
  });

  it('길이가 다르거나 글자가 다르면 다른 사람', () => {
    expect(isMaskedNameMatch('김지환', '김지환수')).toBe(false);
    expect(isMaskedNameMatch('김지환', '박지환')).toBe(false);
    expect(isMaskedNameMatch('', '김지환')).toBe(false);
  });
});

describe('카드목록파싱', () => {
  it('콤마 문자열을 순서 유지하며 배열로', () => {
    expect(카드목록파싱('9427,8713')).toEqual(['9427', '8713']);
    expect(카드목록파싱(' 9427 , 8713 ')).toEqual(['9427', '8713']);
  });

  it('중복과 빈 값은 정리한다', () => {
    expect(카드목록파싱('9427,,9427,8713')).toEqual(['9427', '8713']);
    expect(카드목록파싱(null)).toEqual([]);
  });
});

describe('isSameUser', () => {
  const 건 = { user: '김*환', cardNumber: '9427' };

  it('이름과 카드가 모두 맞아야 내 것', () => {
    expect(isSameUser(건, '김지환', '9427')).toBe(true);
    expect(isSameUser(건, '김지환', '8713')).toBe(false);
    expect(isSameUser(건, '홍동수', '9427')).toBe(false);
  });

  it('카드 목록 중 하나만 맞아도 된다', () => {
    expect(isSameUser(건, '김지환', '8713,9427')).toBe(true);
  });

  it('카드를 안 주면 이름만으로 본다 (구버전 세션)', () => {
    expect(isSameUser(건, '김지환')).toBe(true);
  });
});

describe('재발급카드찾기', () => {
  // 2026-08 전원 카드 교체. 8713 → 9427 로 바뀌어도 과거 내역이 보여야 한다.
  const all = [
    { user: '김지환', cardNumber: '8713', date: '2026-06-10' },
    { user: '김지환', cardNumber: '8713', date: '2026-07-30' },
    { user: '김*환', cardNumber: '9427', date: '2026-08-05' },
    { user: '홍동수', cardNumber: '6522', date: '2026-08-05' },
  ];

  it('기간이 안 겹치는 같은 이름의 카드를 옛 카드로 본다', () => {
    expect(재발급카드찾기(all, '김지환', '9427')).toEqual(['8713']);
  });

  it('남의 카드는 가져오지 않는다', () => {
    expect(재발급카드찾기(all, '홍동수', '6522')).toEqual([]);
  });

  it('쓰던 기간이 서로 겹치면 동명이인일 수 있으므로 넣지 않는다', () => {
    // 두 카드를 같은 시기에 나란히 쓰고 있었다면 재발급이 아니다.
    const 겹침 = [
      { user: '김지환', cardNumber: '8713', date: '2026-08-01' },
      { user: '김지환', cardNumber: '8713', date: '2026-08-10' },
      { user: '김지환', cardNumber: '9427', date: '2026-08-05' },
      { user: '김지환', cardNumber: '9427', date: '2026-08-15' },
    ];
    expect(재발급카드찾기(겹침, '김지환', '9427')).toEqual([]);
  });

  it('옛 카드가 끊긴 뒤 새 카드가 시작하면 재발급으로 본다', () => {
    const 연속 = [
      { user: '김지환', cardNumber: '8713', date: '2026-08-05' },
      { user: '김지환', cardNumber: '9427', date: '2026-08-06' },
    ];
    expect(재발급카드찾기(연속, '김지환', '9427')).toEqual(['8713']);
  });

  it('새 카드로 긁은 게 아직 없으면 후보가 하나일 때만 인정한다', () => {
    const 새카드기록없음 = [
      { user: '김지환', cardNumber: '8713', date: '2026-06-10' },
    ];
    expect(재발급카드찾기(새카드기록없음, '김지환', '9427')).toEqual(['8713']);

    const 후보둘 = [
      { user: '김지환', cardNumber: '8713', date: '2026-06-10' },
      { user: '김지환', cardNumber: '1234', date: '2026-07-10' },
    ];
    expect(재발급카드찾기(후보둘, '김지환', '9427')).toEqual([]);
  });

  // 2026-08-18 회귀: 시트가 날짜를 Date 원문으로 흘리면 "Wed" < "Thu" 라
  // 기간 비교가 뒤집혀 옛 카드를 못 찾았다. 정규화 후에는 정상 동작한다.
  it('정규화된 날짜라야 기간 비교가 맞는다', () => {
    expect(재발급카드찾기(all, '김지환', '9427')).toEqual(['8713']);
  });
});
