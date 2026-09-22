// 수기 제외 항목. 예전엔 user 를 쿼리/바디로 그대로 받아서
// 남의 이름을 넣으면 그 사람 설정을 읽고 바꿀 수 있었다. 신원은 세션에서 받는다.
import type { NextApiRequest, NextApiResponse } from 'next';
import { 요청자확인 } from '../../lib/auth';
import { csv행만들기, 탭CSV주소 } from '../../lib/sheet-csv';

// 수기 제외 탭. apps-script/Code.gs 의 EXCLUDE_GID 와 같은 값이어야 한다.
const EXCLUDE_GID = 1126526954;
const CSV_제한시간_MS = 5000;

// 조회는 get-total-fee 와 같은 이유로 CSV를 먼저 읽는다(Apps Script 는 7초대).
// 실패하면 Apps Script 로 물러난다. 토글(POST)은 그대로 Apps Script 가 한다.
const 제외목록읽기 = async (endpoint: string, user: string): Promise<string[]> => {
  const csvUrl = process.env.SHEET_CSV_URL;
  if (csvUrl) {
    try {
      const response = await fetch(탭CSV주소(csvUrl, EXCLUDE_GID), {
        signal: AbortSignal.timeout(CSV_제한시간_MS),
      });
      if (!response.ok) throw new Error(`CSV 응답 ${response.status}`);
      return csv행만들기<{ user: string; itemId: string }>(
        await response.text(),
        ['user', 'itemId']
      )
        .filter((row) => row.user.trim() === user)
        .map((row) => row.itemId.trim());
    } catch (err) {
      console.log(
        '제외 목록 CSV 조회 실패, Apps Script로 다시 받습니다:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const response = await fetch(
    `${endpoint}?type=excludedItems&user=${encodeURIComponent(user)}`
  );
  if (!response.ok) throw new Error(`시트 응답 ${response.status}`);
  const body = (await response.json()) as { data?: unknown };
  if (!Array.isArray(body?.data)) {
    throw new Error('시트 응답 형식이 예상과 다릅니다');
  }
  return body.data.map(String);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const endpoint = process.env.API_ENDPOINT || '';
  const who = 요청자확인(req, res);
  if (!who) return;
  const user = who.name;

  if (req.method === 'GET') {
    try {
      res.status(200).json({ data: await 제외목록읽기(endpoint, user) });
    } catch (err) {
      res
        .status(502)
        .json({ message: err instanceof Error ? err.message : '에러' });
    }
    return;
  }

  if (req.method === 'POST') {
    const itemId = String(req.body?.itemId ?? '').trim();
    if (!itemId) {
      res.status(400).json({ message: 'itemId 필요' });
      return;
    }
    try {
      const response = await fetch(`${endpoint}?type=exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, itemId }),
      });
      if (!response.ok) throw new Error(`시트 응답 ${response.status}`);
      res.status(200).json(await response.json());
    } catch (err) {
      res
        .status(502)
        .json({ message: err instanceof Error ? err.message : '에러' });
    }
    return;
  }

  res.status(405).json({ message: 'Method not allowed' });
}
