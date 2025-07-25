// pages/api/proxy.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { patchHtml } from '../../lib/patchHtml';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || 'text/plain';

    let body = await response.text();

    // HTML이면 파싱 + 링크 변환
    if (contentType.includes('text/html')) {
      body = patchHtml(body, url);
      res.setHeader('Content-Type', 'text/html');
    } else {
      res.setHeader('Content-Type', contentType);
    }

    res.status(200).send(body);
  } catch (err: any) {
    res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
