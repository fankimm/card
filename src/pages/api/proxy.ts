// pages/api/proxy.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query param' });
  }

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || 'text/plain';
    const body = await response.text();

    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(body);
  } catch (err: any) {
    res.status(500).json({ error: 'Proxy failed', detail: err.message });
  }
}
