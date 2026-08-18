// 카드 결제 문자 파싱.
//
// 예전엔 hello.ts 안에서 바로 인덱스를 까 내려갔는데, 그러면
//  (1) 결제 문자가 아닌 것(광고·결제예정 안내·카드 갱신 안내)이 들어오면 split에서 터져
//      로그에 '실패'로 쌓이고, 진짜 파싱 실패가 그 안에 묻힌다.
//  (2) 테스트를 못 짠다.
// 그래서 순수 함수로 떼어내고, 결제 문자가 아니면 명시적으로 '무시'를 돌려준다.
import dayjs from 'dayjs';

export interface ParsedSms {
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  fee: number;
  place: string;
}

export type ParseResult =
  | { kind: '결제'; data: ParsedSms }
  | { kind: '무시'; reason: string };

// 우리가 처리하는 승인 종류. 이 밖의 문자는 결제 건이 아니다.
const 결제종류 = ['승인', '취소', '해외승인'];

// MM/DD 를 연도까지 채운다.
// 12/31 결제 문자가 1/1 새벽에 들어오면 올해로 찍혀 1년 뒤가 되어버린다.
// 기준일보다 한참(7일 초과) 미래로 나오면 작년 것으로 본다.
export const 연도보정 = (mmdd: string, 기준: dayjs.Dayjs): dayjs.Dayjs | null => {
  const m = mmdd.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const 후보 = dayjs(
    `${기준.format('YYYY')}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  );
  if (!후보.isValid()) return null;
  return 후보.diff(기준, 'day') > 7 ? 후보.subtract(1, 'year') : 후보;
};

export const parseSms = (원문: unknown, 기준: dayjs.Dayjs): ParseResult => {
  if (typeof 원문 !== 'string' || !원문.trim()) {
    return { kind: '무시', reason: '문자 본문이 없습니다' };
  }

  const lines = 원문
    .replaceAll('\r', '')
    .replaceAll('님', '')
    .replaceAll(',', '')
    .split('\n');

  if (lines.length < 5) {
    return { kind: '무시', reason: '결제 문자 형식이 아닙니다 (줄 수 부족)' };
  }

  // 1행: "[MY COMPANY] 승인" 꼴. 세 번째 토큰이 승인 종류다.
  const confirmType = (lines[1] || '').trim().split(' ')[2] || '';
  if (!결제종류.includes(confirmType)) {
    return {
      kind: '무시',
      reason: `결제 문자가 아닙니다 (${(lines[1] || '').trim().slice(0, 30)})`,
    };
  }

  // 2행: "9427 김*환" 꼴
  const 카드와이름 = (lines[2] || '').trim().match(/^(\d{4})\s+(\S+)/);
  if (!카드와이름) {
    return { kind: '무시', reason: '카드번호/이름 줄을 못 읽었습니다' };
  }
  const [, cardNumber, user] = 카드와이름;

  // 잔여한도가 붙어 오는 문자는 결제일시 줄이 빠져 있다. 그때만 수신 시각으로 대신한다.
  const 잔여한도포함 = lines.some((line) => line.includes('잔여한도'));
  const 금액줄 = 잔여한도포함 ? lines[3] : lines[4];
  const place = (잔여한도포함 ? lines[4] : lines[5])?.trim() || '';

  const 금액 = (금액줄 || '').trim().match(/^(\d+)원/);
  if (!금액) {
    // "USD 100.00" 같은 해외 결제는 원화 금액이 없어 지원 대상이 될 수 없다
    return {
      kind: '무시',
      reason: `원화 금액을 못 읽었습니다 (${(금액줄 || '').trim().slice(0, 20)})`,
    };
  }
  if (!place) {
    return { kind: '무시', reason: '가맹점 줄이 비어 있습니다' };
  }

  let 결제일: dayjs.Dayjs;
  let time: string;
  if (잔여한도포함) {
    결제일 = 기준;
    time = 기준.format('HH:mm:ss');
  } else {
    const [mmdd, hhmm] = (lines[3] || '').trim().split(' ');
    const d = 연도보정(mmdd || '', 기준);
    if (!d || !/^\d{1,2}:\d{2}/.test(hhmm || '')) {
      return { kind: '무시', reason: `결제일시를 못 읽었습니다 (${lines[3]})` };
    }
    결제일 = d;
    time = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  }

  return {
    kind: '결제',
    data: {
      confirmType,
      cardNumber,
      user,
      date: 결제일.format('YYYY-MM-DD'),
      time,
      fee: parseInt(금액[1], 10),
      place,
    },
  };
};
