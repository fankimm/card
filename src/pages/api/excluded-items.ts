// 수기 제외 항목. 예전엔 user 를 쿼리/바디로 그대로 받아서
// 남의 이름을 넣으면 그 사람 설정을 읽고 바꿀 수 있었다. 신원은 세션에서 받는다.
import type { NextApiRequest, NextApiResponse } from 'next';
import { 요청자확인 } from '../../lib/auth';

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
      const response = await fetch(
        `${endpoint}?type=excludedItems&user=${encodeURIComponent(user)}`
      );
      if (!response.ok) throw new Error(`시트 응답 ${response.status}`);
      res.status(200).json(await response.json());
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
