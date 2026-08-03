// 이용내역 공통 필터 로직.
// get-total-fee / usages-list 두 API와 화면(index.tsx)이 같은 규칙으로 걸러야 해서 여기로 모았다.
import dayjs from 'dayjs';
import { isSameUser } from './user-match';

export interface UsageItem {
  id?: string;
  confirmType: string;
  cardNumber?: string;
  user?: string;
  date: string;
  time: string;
  fee: string | number;
  place?: string;
}

// 취소 건은 원래 결제를 없던 일로 만든다.
// 같은 카드·같은 날·같은 금액·같은 가맹점끼리 묶어, 취소 1건당 승인 1건을 지운다.
// (취소하고 바로 다시 긁은 날은 승인이 2건 잡히는데, 그중 한 건만 상쇄되고 나머지는 남아야 한다.)
export const 취소상쇄 = <T extends UsageItem>(items: T[]): T[] => {
  const key = (i: T) =>
    `${i.cardNumber || ''}|${i.date}|${String(i.fee)}|${i.place || ''}`;

  const 취소수 = new Map<string, number>();
  for (const i of items) {
    if (i.confirmType === '취소') {
      취소수.set(key(i), (취소수.get(key(i)) || 0) + 1);
    }
  }
  if (취소수.size === 0) return items;

  // 취소와 시각이 가까운 승인부터 지운다.
  const 지울승인 = new Set<T>();
  for (const c of items) {
    if (c.confirmType !== '취소') continue;
    const 후보 = items
      .filter(
        (i) =>
          i.confirmType === '승인' && key(i) === key(c) && !지울승인.has(i)
      )
      .sort(
        (a, b) =>
          Math.abs(시각차(a.time, c.time)) - Math.abs(시각차(b.time, c.time))
      );
    if (후보[0]) 지울승인.add(후보[0]);
  }

  return items.filter((i) => i.confirmType !== '취소' && !지울승인.has(i));
};

// "11:42:00" 같은 시각을 초로 바꿔 차이를 잰다. 시가 한 자리('9:21:00')로 오는 데이터도 있다.
const 시각차 = (a: string, b: string) => 초로(a) - 초로(b);
const 초로 = (t: string) => {
  const [h = '0', m = '0', s = '0'] = (t || '').split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

// 점심 지원 대상 판정: 코어타임(10~16시) + 1회 한도 2만원.
// 시각을 문자열로 비교하면 '9:21:00' > '10:00:00' 이 참이 되므로 초로 바꿔서 비교한다.
export const 점심지원대상 = (item: UsageItem) => {
  const 초 = 초로(item.time);
  if (초 <= 10 * 3600 || 초 >= 16 * 3600) return false;
  return Math.abs(parseInt(String(item.fee), 10) || 0) <= 20000;
};

// 전체 내역에서 "내 것 + 해당 월 + 점심 지원 대상"만 추린다. 취소는 상쇄해서 뺀다.
export const 월별내역추리기 = <T extends UsageItem & { user?: string }>(
  all: T[],
  name: string,
  card: string | null | undefined,
  date: string
): T[] => {
  const month = dayjs(date);
  const 내역 = (all || []).filter(
    (i) =>
      i.user &&
      isSameUser(i, name, card || undefined) &&
      dayjs(i.date).isSame(month, 'month')
  );
  return 취소상쇄(내역)
    .filter(점심지원대상)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
};

// 출근했는데 결제 기록이 하나도 없는 날 = 카드 문자가 안 들어왔을 가능성.
// 지난 날짜만 본다(오늘은 아직 점심 전일 수 있으므로 제외).
// 판정은 원본 전체 내역으로 한다 — 2만원 넘게 쓴 날을 "결제 없음"으로 오해하지 않기 위해서다.
export const 누락의심일찾기 = <T extends UsageItem & { user?: string }>(
  all: T[],
  name: string,
  card: string | null | undefined,
  출근일: string[],
  오늘: string
): string[] => {
  if (!출근일?.length) return [];
  const 결제한날 = new Set(
    (all || [])
      .filter((i) => i.user && isSameUser(i, name, card || undefined))
      .map((i) => i.date)
  );
  return 출근일.filter((d) => d < 오늘 && !결제한날.has(d)).sort();
};
