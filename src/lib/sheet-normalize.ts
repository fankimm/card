// 시트가 날짜·시간 칸을 Date 원문("Wed Aug 05 2026 00:00:00 GMT+0900")으로
// 돌려줄 때가 있다. Apps Script 쪽에 포맷 분기(cellText)가 있지만, 그 런타임에서
// value instanceof Date 가 거짓으로 떨어져 전 행이 String(value)로 새는 일이 있었다.
//
// 그대로 두면 시각 파싱이 NaN이 되고 날짜 문자열 정렬이 뒤집혀서
// ("Wed" < "Thu") 재발급 카드 탐지와 누락일 판정이 조용히 오답을 낸다.
// Apps Script를 고쳐도 이 안전망은 남겨둔다 — 배포가 또 밀려도 앱이 안 깨진다.

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HMS = /^\d{1,2}:\d{2}(:\d{2})?$/;

export const 날짜정규화 = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s || YMD.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  // 자정 + KST 오프셋이라 UTC로 찍으면 하루 밀린다(Vercel은 UTC). 반드시 서울 기준으로.
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

// 시간 칸은 Date로 파싱하면 1899년 기준 지방시(+08:27) 때문에 시각이 밀린다.
// 문자열에 적힌 벽시계 시각을 그대로 뽑아 쓴다.
export const 시각정규화 = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s || HMS.test(s)) return s;
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}` : s;
};

export const 행정규화 = <T extends { date: string; time: string }>(
  rows: T[]
): T[] =>
  rows.map((r) => ({
    ...r,
    date: 날짜정규화(r.date),
    time: 시각정규화(r.time),
  }));
