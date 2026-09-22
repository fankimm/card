// 시트를 CSV로 바로 읽는다.
//
// Apps Script doGet 은 같은 시트를 돌려주는 데 7초대가 걸린다(2026-09-21 실측 7.6초).
// 구글이 직접 내주는 CSV(export?format=csv)는 1초 안팎이고, 셀에 "보이는 값"을 그대로
// 주기 때문에 날짜·시간도 처음부터 2026-08-05 / 12:11:00 모양이다.
//
// gviz(tq?tqx=out:csv)가 조금 더 빠르지만 쓰지 않는다. 열 타입을 추측해서, 숫자 열에
// 글자가 한 칸 섞이면 그 칸을 조용히 빈 값으로 내보낸다.

// 따옴표 안의 쉼표·줄바꿈·""(따옴표 자체)까지 처리한다. 가맹점 이름에 쉼표가 들어올 수 있다.
export const csv파싱 = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

/**
 * CSV 본문을 Apps Script 의 rowsAsObjects 와 같은 모양(헤더 → 문자열 값)으로 바꾼다.
 *
 * 시트 공유가 꺼지면 구글은 CSV 대신 로그인 페이지 HTML을 200으로 준다. 그걸 그대로
 * 파싱하면 "내역 0건"이 되어 장애가 정상처럼 보이므로, 필수 열이 없으면 던진다.
 */
export const csv행만들기 = <T = Record<string, string>>(
  text: string,
  필수열: string[]
): T[] => {
  const [헤더원본, ...본문] = csv파싱(text);
  const 헤더 = (헤더원본 ?? []).map((h) => h.trim());
  const 빠진열 = 필수열.filter((c) => !헤더.includes(c));
  if (빠진열.length > 0) {
    throw new Error(`CSV에 열이 없습니다: ${빠진열.join(', ')}`);
  }

  const out: T[] = [];
  for (const 줄 of 본문) {
    if ((줄[0] ?? '').trim() === '') continue; // 빈 줄은 건너뛴다
    const obj: Record<string, string> = {};
    헤더.forEach((h, c) => {
      if (h) obj[h] = 줄[c] ?? '';
    });
    out.push(obj as T);
  }
  return out;
};

/**
 * SHEET_CSV_URL 은 결제 내역 탭(gid=0)을 가리킨다. 같은 시트의 다른 탭은 gid 만 바꾸면 된다.
 * 탭마다 환경변수를 하나씩 늘리지 않으려고 여기서 갈아 끼운다.
 */
export const 탭CSV주소 = (baseUrl: string, gid: number): string =>
  /[?&]gid=\d+/.test(baseUrl)
    ? baseUrl.replace(/([?&])gid=\d+/, `$1gid=${gid}`)
    : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}gid=${gid}`;
