import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { parseSms, 연도보정 } from '../sms-parse';

// 아래 문자들은 전부 로그 탭에 실제로 남아 있던 원문이다.
const 승인 =
  '[Web발신]\n[MY COMPANY] 승인\r\n9427 김*환님\r\n08/13 11:42\r\n14,000원 일시불\r\n루나아시아';
const 잔여한도포함 =
  '[Web발신]\n[MY COMPANY] 승인\r\n8713 김지환님\r\n16,750원 일시불\r\n오늘은닭\r\n잔여한도: 476,000원';
const 해외승인 =
  '[Web발신]\n[MY COMPANY] 해외승인\r\n9427 김*환님\r\n08/05 18:58\r\nUSD 100.00\r\nANTHROPIC*CLAUDESUB';
const 결제예정안내 =
  '[Web발신]\n[MY COMPANY] 현대카드 당월 결제 예정 금액 안내\r\n\r\n회원님, 당월 법인카드 결제 예정 결제금액을 안내 해드립니다\r\n\r\n[상세 안내]\r\n- 대상카드 : 9427 카드\r\n- 결제 예정 금액 : 316,224원 (08/06 기준)\r\n- 결제일 : 08/20';
const 카드갱신안내 =
  '[Web발신]\n[현대카드] 카드 갱신 발급 안내\r\n\r\n김*환 회원님,\r\n보유카드 유효기간 만료로 새 카드 발급 예정입니다.\r\n\r\n[만료 예정 카드]\r\n(본인카드) 네이버 현대카드 (202611 만료) / 비자';
const 광고 =
  '[Web발신]\n(광고)[현대카드] 마곡 롯데캐슬 르웨스트 분양 안내\r\n\r\n마곡지구 마지막 대단지\r\n실입주금 1억원부터\r\n\r\n[문의] 1555-5350';
const 배관테스트 = 'claude 로그 배관 테스트';

const 기준 = dayjs('2026-08-18T11:39:00');

describe('parseSms — 결제 문자', () => {
  it('일반 승인 문자를 읽는다', () => {
    const r = parseSms(승인, 기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data).toEqual({
      confirmType: '승인',
      cardNumber: '9427',
      user: '김*환',
      date: '2026-08-13',
      time: '11:42:00',
      fee: 14000,
      place: '루나아시아',
    });
  });

  it('잔여한도가 붙은 문자는 결제일시 줄이 없어 수신 시각으로 채운다', () => {
    const r = parseSms(잔여한도포함, 기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data).toMatchObject({
      confirmType: '승인',
      cardNumber: '8713',
      user: '김지환',
      date: '2026-08-18',
      time: '11:39:00',
      fee: 16750,
      place: '오늘은닭',
    });
  });

  it('취소 문자도 읽는다', () => {
    const 취소 = 승인.replace('] 승인', '] 취소');
    const r = parseSms(취소, 기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data.confirmType).toBe('취소');
  });
});

describe('parseSms — 결제 문자가 아닌 것', () => {
  // 예전엔 이것들이 전부 split에서 터져 로그에 '실패'로 쌓였고,
  // 진짜 파싱 실패가 그 안에 묻혔다.
  it.each([
    ['결제예정 안내', 결제예정안내],
    ['카드 갱신 안내', 카드갱신안내],
    ['광고', 광고],
    ['배관 테스트', 배관테스트],
    ['빈 문자', ''],
  ])('%s → 무시', (_label, 원문) => {
    expect(parseSms(원문, 기준).kind).toBe('무시');
  });

  it('본문이 문자열이 아니어도 터지지 않는다', () => {
    expect(parseSms(undefined, 기준).kind).toBe('무시');
    expect(parseSms({ test: 'x' }, 기준).kind).toBe('무시');
  });

  it('원화 금액이 없는 해외승인은 무시한다', () => {
    const r = parseSms(해외승인, 기준);
    expect(r.kind).toBe('무시');
    if (r.kind !== '무시') return;
    expect(r.reason).toContain('원화');
  });
});

describe('연도보정', () => {
  it('보통은 올해로 채운다', () => {
    expect(연도보정('08/13', 기준)?.format('YYYY-MM-DD')).toBe('2026-08-13');
  });

  // 12/31 결제 문자가 1/1 새벽에 들어오면 올해로 찍혀 1년 뒤가 되어버린다.
  it('연말 결제가 연초에 들어오면 작년으로 본다', () => {
    const 새해 = dayjs('2027-01-01T00:30:00');
    expect(연도보정('12/31', 새해)?.format('YYYY-MM-DD')).toBe('2026-12-31');
  });

  it('며칠 정도 미래는 그대로 둔다 (수신 지연 여지)', () => {
    expect(연도보정('08/20', 기준)?.format('YYYY-MM-DD')).toBe('2026-08-20');
  });

  it('형식이 아니면 null', () => {
    expect(연도보정('2026-08-13', 기준)).toBeNull();
    expect(연도보정('', 기준)).toBeNull();
  });
});

describe('parseSms — 연말 경계', () => {
  it('12/31 문자가 1/1에 들어와도 작년 날짜로 기록한다', () => {
    const 새해 = dayjs('2027-01-01T00:30:00');
    const 문자 =
      '[Web발신]\n[MY COMPANY] 승인\r\n9427 김*환님\r\n12/31 12:18\r\n20,000원 일시불\r\n오늘은닭';
    const r = parseSms(문자, 새해);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data.date).toBe('2026-12-31');
  });
});

// 2026-09-16 부터 온 세 번째 양식. 헤더에 카드번호가 올라가고 이름 줄에서 빠졌다.
// 바뀐 날 점심 문자 4건이 전부 "결제 문자가 아닙니다 (MY COMPANY 2613  승인)" 로 무시됐다.
describe('parseSms — 2026-09 신형 (헤더에 카드번호)', () => {
  const 신형승인 =
    '[Web발신]\nMY COMPANY 2613  승인\r\n한*님\r\n09/16 11:29\r\n14,000원 일시불\r\n이관복명장냉면선릉점';
  const 신형기준 = dayjs('2026-09-16T11:29:21');

  it('헤더의 카드번호와 이름 줄을 읽는다', () => {
    const r = parseSms(신형승인, 신형기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data).toEqual({
      confirmType: '승인',
      cardNumber: '2613',
      user: '한*',
      date: '2026-09-16',
      time: '11:29:00',
      fee: 14000,
      place: '이관복명장냉면선릉점',
    });
  });

  it('세 글자 이름도 그대로', () => {
    const r = parseSms(
      '[Web발신]\nMY COMPANY 9427  승인\r\n김*환님\r\n09/16 11:29\r\n14,000원 일시불\r\n이관복명장냉면선릉점',
      신형기준
    );
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data).toMatchObject({ cardNumber: '9427', user: '김*환' });
  });

  it('취소도 읽는다', () => {
    const r = parseSms(신형승인.replace('  승인', '  취소'), 신형기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data.confirmType).toBe('취소');
    expect(r.data.cardNumber).toBe('2613');
  });

  it('신형 해외승인도 원화 금액이 없으면 무시', () => {
    const r = parseSms(
      '[Web발신]\nMY COMPANY 6522  해외승인\r\n홍*수님\r\n09/16 15:06\r\nUSD 20.00\r\nOPENAI*CHATGPTSUBSCR',
      신형기준
    );
    expect(r.kind).toBe('무시');
    if (r.kind !== '무시') return;
    expect(r.reason).toContain('원화');
    expect(r.reason).toContain('USD');
  });

  it('구형·신형 어느 쪽이든 결제가 아닌 안내문은 여전히 무시', () => {
    expect(
      parseSms('[Web발신]\nMY COMPANY 9427 결제 예정 금액 안내\r\n김*환님\r\n\r\n- 결제일 : 09/20\r\n- 금액', 신형기준)
        .kind
    ).toBe('무시');
  });

  it('시가 한 자리인 시각도 HH:mm:ss 로 맞춘다', () => {
    const r = parseSms(신형승인.replace('09/16 11:29', '09/16 9:21'), 신형기준);
    expect(r.kind).toBe('결제');
    if (r.kind !== '결제') return;
    expect(r.data.time).toBe('09:21:00');
  });
});
