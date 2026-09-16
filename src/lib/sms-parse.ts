// 카드 결제 문자 파싱.
//
// 예전엔 hello.ts 안에서 바로 인덱스를 까 내려갔는데, 그러면
//  (1) 결제 문자가 아닌 것(광고·결제예정 안내·카드 갱신 안내)이 들어오면 split에서 터져
//      로그에 '실패'로 쌓이고, 진짜 파싱 실패가 그 안에 묻힌다.
//  (2) 테스트를 못 짠다.
// 그래서 순수 함수로 떼어내고, 결제 문자가 아니면 명시적으로 '무시'를 돌려준다.
//
// 현대카드는 문자 양식을 예고 없이 바꾼다. 지금까지 본 것:
//
//   [MY COMPANY] 승인            [MY COMPANY] 승인             MY COMPANY 9427  승인
//   8713 김지환님                 9427 김*환님                  김*환님
//   16,750원 일시불               08/13 11:42                   09/16 11:29
//   오늘은닭                      14,000원 일시불               14,000원 일시불
//   잔여한도: 476,000원           루나아시아                    이관복명장냉면선릉점
//   (~2026-07)                   (2026-08 ~ 09-15)             (2026-09-16 ~)
//
// 세 번째로 바뀐 날 점심 문자 4건이 통째로 '무시'됐다. 그래서 줄 번호가 아니라
// 줄의 모양(날짜 꼴, 금액 꼴)으로 찾는다. 다음에 또 바뀌어도 줄이 밀리는 정도면 버틴다.
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

const 일시꼴 = /^(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/;
const 금액꼴 = /^(\d+)원/;

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

// "11:29" → "11:29:00", "9:21" → "09:21:00". 시트와 조회 필터는 HH:mm:ss 를 기대한다.
const 시각정규화 = (hhmm: string) => {
  const [hh, mm, ss = '00'] = hhmm.split(':');
  return `${hh.padStart(2, '0')}:${mm}:${ss}`;
};

export const parseSms = (원문: unknown, 기준: dayjs.Dayjs): ParseResult => {
  if (typeof 원문 !== 'string' || !원문.trim()) {
    return { kind: '무시', reason: '문자 본문이 없습니다' };
  }

  const lines = 원문
    .replaceAll('\r', '')
    .replaceAll('님', '')
    .replaceAll(',', '')
    .split('\n')
    .map((line) => line.trim());

  if (lines.length < 5) {
    return { kind: '무시', reason: '결제 문자 형식이 아닙니다 (줄 수 부족)' };
  }

  // 1행: 승인 종류는 마지막 토큰이다.
  //   구형 "[MY COMPANY] 승인" / 신형 "MY COMPANY 2613  승인" (신형은 카드번호가 여기 있다)
  const 헤더 = lines[1] || '';
  const 헤더토큰 = 헤더.split(/\s+/).filter(Boolean);
  const confirmType = 헤더토큰[헤더토큰.length - 1] || '';
  if (!결제종류.includes(confirmType)) {
    return { kind: '무시', reason: `결제 문자가 아닙니다 (${헤더.slice(0, 30)})` };
  }

  // 2행: 이름. 구형은 "9427 김*환", 신형은 "김*환" 만 온다.
  // 카드번호는 2행에 있으면 그것을, 없으면 1행에서 찾는다.
  const 이름줄 = (lines[2] || '').match(/^(?:(\d{4})\s+)?(\S+)/);
  const 헤더카드 = 헤더토큰.find((token) => /^\d{4}$/.test(token));
  const cardNumber = 이름줄?.[1] || 헤더카드;
  const user = 이름줄?.[2];
  if (!cardNumber || !user) {
    return { kind: '무시', reason: '카드번호/이름 줄을 못 읽었습니다' };
  }

  // 나머지는 자리 대신 모양으로 찾는다. 금액 바로 다음 줄이 가맹점이다.
  const 본문 = lines.slice(3);
  const 일시index = 본문.findIndex((line) => 일시꼴.test(line));
  const 금액index = 본문.findIndex((line) => 금액꼴.test(line));

  if (금액index < 0) {
    // "USD 100.00" 같은 해외 결제는 원화 금액이 없어 지원 대상이 될 수 없다
    const 힌트 = 일시index >= 0 ? 본문[일시index + 1] : 본문[1];
    return {
      kind: '무시',
      reason: `원화 금액을 못 읽었습니다 (${(힌트 || '').slice(0, 20)})`,
    };
  }
  const fee = parseInt(본문[금액index].match(금액꼴)![1], 10);
  const place = 본문[금액index + 1] || '';
  if (!place) {
    return { kind: '무시', reason: '가맹점 줄이 비어 있습니다' };
  }

  // 결제일시 줄이 없는 양식(잔여한도가 붙는 것)은 수신 시각으로 대신한다.
  let 결제일 = 기준;
  let time = 기준.format('HH:mm:ss');
  if (일시index >= 0) {
    const [, mmdd, hhmm] = 본문[일시index].match(일시꼴)!;
    const d = 연도보정(mmdd, 기준);
    if (!d) {
      return { kind: '무시', reason: `결제일시를 못 읽었습니다 (${본문[일시index]})` };
    }
    결제일 = d;
    time = 시각정규화(hhmm);
  }

  return {
    kind: '결제',
    data: {
      confirmType,
      cardNumber,
      user,
      date: 결제일.format('YYYY-MM-DD'),
      time,
      fee,
      place,
    },
  };
};
