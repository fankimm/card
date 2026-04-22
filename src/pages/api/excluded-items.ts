import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const endpoint = process.env.API_ENDPOINT || '';

  if (req.method === 'GET') {
    const user = req.query.name as string;
    if (!user) return res.status(400).json({ message: 'name 필요' });
    try {
      const response = await fetch(
        `${endpoint}?type=excludedItems&user=${encodeURIComponent(user)}`
      );
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : '에러' });
    }
  } else if (req.method === 'POST') {
    const { user, itemId } = req.body;
    if (!user || !itemId) return res.status(400).json({ message: 'user, itemId 필요' });
    try {
      const response = await fetch(`${endpoint}?type=exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, itemId }),
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : '에러' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
