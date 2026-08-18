// 이용내역 조회 API.
//
// 예전에는 시트에서 받은 전체 내역(allData)을 그대로 내려줬는데,
// 그 안에 전원의 이름 + 카드 뒷 4자리가 들어 있었다. 이 앱의 로그인 수단이 바로 그 둘이라,
// 인증 없이 부를 수 있는 이 API 하나가 로그인 방벽을 통째로 무력화하고 있었다.
// 지금은 내 것(myData)과 이름·카드번호를 뺀 익명 내역(publicData)으로 갈라서 내보낸다.
import type { NextApiRequest, NextApiResponse } from 'next';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { isSameUser, 재발급카드찾기, 카드목록파싱 } from '../../lib/user-match';
import { 취소상쇄, 점심지원대상 } from '../../lib/usage-filter';

export interface Data {
  id: string;
  createdAt: string;
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

// 통계 탭의 "전체" 랭킹은 남의 내역까지 봐야 만들어진다.
// 대신 누구 것인지는 알 수 없게 이름과 카드번호를 떼고 내보낸다.
export interface PublicUsage {
  confirmType: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

declare global {
  // eslint-disable-next-line no-var
  var cachedData: Data[] | undefined;
  // eslint-disable-next-line no-var
  var cachedAt: number | undefined;
}

// 캐시를 무기한 들고 있으면 인스턴스가 살아있는 동안 새 결제가 영영 안 보인다.
// 3분 지나면 다시 받아온다.
const CACHE_TTL_MS = 3 * 60 * 1000;

// 시트가 날짜·시간 칸을 Date 원문("Wed Aug 05 2026 00:00:00 GMT+0900")으로 돌려줄 때가 있다.
// Apps Script 쪽에 포맷 분기(cellText)가 있지만 배포 버전이 그보다 오래되면 그냥 새어 나온다.
// 그대로 두면 시각 파싱이 NaN이 되고 날짜 문자열 정렬이 뒤집혀서
// (Wed > Thu) 재발급 카드 탐지와 누락일 판정이 조용히 오답을 낸다. 여기서 되돌린다.
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HMS = /^\d{1,2}:\d{2}(:\d{2})?$/;

const 날짜정규화 = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s || YMD.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  // 자정 + KST 오프셋이라 UTC로 찍으면 하루 밀린다. 반드시 서울 기준으로.
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day}`;
};

// 시간 칸은 Date로 파싱하면 1899년 기준 지방시(+08:27) 때문에 시각이 27분 밀린다.
// 문자열에 적힌 벽시계 시각을 그대로 뽑아 쓴다.
const 시각정규화 = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s || HMS.test(s)) return s;
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}` : s;
};

const 정규화 = (rows: Data[]): Data[] =>
  rows.map((r) => ({
    ...r,
    date: 날짜정규화(r.date),
    time: 시각정규화(r.time),
  }));

const 익명화 = (items: Data[]): PublicUsage[] =>
  items.map(({ confirmType, date, time, fee, place }) => ({
    confirmType,
    date,
    time,
    fee,
    place,
  }));

// 시트에서 전체 내역을 받아 캐시한다.
// 실패를 조용히 삼키면 화면에 "0원"이 떠서 장애가 정상처럼 보인다. 그래서
// 만료된 캐시라도 있으면 그걸 쓰고(금액이 틀리지는 않는다), 그것마저 없으면 던진다.
export const getData = async (): Promise<Data[]> => {
  const 만료 = !global.cachedAt || Date.now() - global.cachedAt > CACHE_TTL_MS;
  if (global.cachedData && !만료) return global.cachedData;

  try {
    const endpoint = process.env.API_ENDPOINT;
    if (!endpoint) throw new Error('API_ENDPOINT 가 설정되지 않았습니다');
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`시트 응답 ${response.status}`);
    const body = (await response.json()) as { data?: Data[] };
    if (!Array.isArray(body?.data)) {
      throw new Error('시트 응답 형식이 예상과 다릅니다');
    }
    const rows = 정규화(body.data);
    global.cachedData = rows;
    global.cachedAt = Date.now();
    return rows;
  } catch (err) {
    const 메시지 = err instanceof Error ? err.message : String(err);
    if (global.cachedData) {
      console.log('시트 조회 실패, 만료된 캐시로 응답합니다:', 메시지);
      return global.cachedData;
    }
    throw new Error(`이용내역을 불러오지 못했습니다: ${메시지}`);
  }
};

// 로그인한 사람의 카드 목록을 확정한다.
// 카드를 재발급받으면 뒷 4자리가 바뀌어 과거 내역이 통째로 안 잡히는데,
// 그 판정에는 전체 내역이 필요하다 — 그래서 클라이언트가 아니라 여기서 한다.
export const 내카드확정 = (all: Data[], name: string, card?: string) => [
  ...카드목록파싱(card),
  ...재발급카드찾기(all, name, card),
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const date = req.query.date as string;
  const user = ((req.query.name as string) || '').trim();
  const card = req.query.card as string;

  if (!user) {
    res.status(400).json({ message: 'name 이 필요합니다' });
    return;
  }

  let all: Data[];
  try {
    all = await getData();
  } catch (err) {
    res
      .status(503)
      .json({ message: err instanceof Error ? err.message : '조회 실패' });
    return;
  }

  const 내카드 = 내카드확정(all, user, card);
  const 내내역 = all.filter((item) => isSameUser(item, user, 내카드));

  // 취소 상쇄를 금액·시간 필터보다 먼저 해야 한다.
  // 2만원 넘는 결제를 취소한 경우, 먼저 걸러버리면 짝을 못 찾아 취소가 붕 뜬다.
  const 이번달 = 내내역.filter((item) =>
    dayjs(item.date).isSame(dayjs(date), 'month')
  );
  const 리스트데이터 = 취소상쇄(이번달)
    .filter(점심지원대상)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const total = 리스트데이터.reduce(
    (a, b) => a + (parseInt(String(b.fee), 10) || 0),
    0
  );

  res.status(200).json({
    message: '성공',
    data: total,
    length: 리스트데이터.length,
    originData: 리스트데이터,
    // 재발급 감지까지 끝난 내 카드 목록. 클라이언트는 이걸 그대로 저장한다.
    cards: 내카드,
    // 내 전체 내역(월 무관). 추천·통계·누락 감지가 지난달까지 훑어야 해서 함께 준다.
    myData: 내내역,
    publicData: 익명화(all),
  });
}
