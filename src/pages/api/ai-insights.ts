import type { NextApiRequest, NextApiResponse } from 'next';

// Simple server-side proxy to Hugging Face Inference API.
// We keep payload minimal and avoid sending any PII/raw rows.

type ReqBody = {
  month?: string;
  weekdayLines?: string[];
  trendLine?: string | null;
  burstLine?: string | null;
  cheapTop5?: { place: string; avg: number }[];
  priceyTop5?: { place: string; avg: number }[];
  badges?: { master: string[]; casual: string[] };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const token = process.env.HUGGING_FACE_API_TOKEN;
  if (!token) {
    res.status(503).json({ message: 'HUGGING_FACE_API_TOKEN missing' });
    return;
  }

  const body = (req.body || {}) as ReqBody;
  try {
    const lines: string[] = [];
    if (body.weekdayLines && body.weekdayLines.length) {
      lines.push(`요일별 패턴: ${body.weekdayLines.join('; ')}`);
    }
    if (body.trendLine) lines.push(`트렌드: ${body.trendLine}`);
    if (body.burstLine) lines.push(`폭주: ${body.burstLine}`);
    if (body.badges) {
      const badgeBits: string[] = [];
      if (body.badges.master?.length)
        badgeBits.push(
          `단골 마스터=${body.badges.master.slice(0, 5).join(',')}`
        );
      if (body.badges.casual?.length)
        badgeBits.push(
          `어쩌다 손님=${body.badges.casual.slice(0, 5).join(',')}`
        );
      if (badgeBits.length) lines.push(`배지: ${badgeBits.join(' | ')}`);
    }
    if (body.cheapTop5?.length) {
      const s = body.cheapTop5
        .slice(0, 5)
        .map((x) => `${x.place}(${Math.round(x.avg)}원)`)
        ?.join(', ');
      lines.push(`가성비 TOP5: ${s}`);
    }
    if (body.priceyTop5?.length) {
      const s = body.priceyTop5
        .slice(0, 5)
        .map((x) => `${x.place}(${Math.round(x.avg)}원)`)
        ?.join(', ');
      lines.push(`고가 TOP5: ${s}`);
    }

    const context = lines.join('\n');
    const prompt = `너는 점심 식당 사용 패턴을 재밌고 간결하게 분석해주는 한국어 분석가야.\n\n다음 집계 데이터를 바탕으로,\n- 핵심 한 문장 요약 1개\n- 재밌는 코멘트 2-3개\n- 이달의 추천 행동 1개\n를 생성해줘. 형식은 불릿 리스트로.\n\n[집계]\n${context}`;

    // 1차: 한국어도 비교적 무난한 지시형 모델 → 실패 시 요약 모델 폴백
    const primaryModel = 'HuggingFaceH4/zephyr-7b-beta';
    const fallbackModel = 'facebook/bart-large-cnn';

    let hfResp = await fetch(
      `https://api-inference.huggingface.co/models/${primaryModel}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: 220, temperature: 0.7, top_p: 0.9 },
          options: { wait_for_model: true },
        }),
      }
    );

    if (!hfResp.ok) {
      hfResp = await fetch(
        `https://api-inference.huggingface.co/models/${fallbackModel}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_length: 200 },
            options: { wait_for_model: true },
          }),
        }
      );
      if (!hfResp.ok) {
        const txt = await hfResp.text();
        res.status(502).json({ message: 'HF inference failed', detail: txt });
        return;
      }
    }
    const data = await hfResp.json();
    // 응답 정규화
    let raw: string;
    if (Array.isArray(data) && data[0]?.summary_text)
      raw = String(data[0].summary_text);
    else if (typeof data === 'string') raw = data;
    else if (data?.generated_text) raw = String(data.generated_text);
    else raw = JSON.stringify(data);

    const sanitize = (t: string) =>
      t
        .replace(/[\u0000-\u001F]/g, ' ')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    let cleaned = sanitize(raw);

    const looksBad = cleaned.length < 24 || /[\u1200-\u137F]/.test(cleaned);
    if (looksBad) {
      const bullets: string[] = [];
      if (lines.length)
        bullets.push(`• 요약: ${lines.slice(0, 2).join(' / ')}`);
      if (body.trendLine) bullets.push(`• 트렌드: ${body.trendLine}`);
      if (body.cheapTop5?.length)
        bullets.push(
          `• 가성비: ${body.cheapTop5
            .slice(0, 3)
            .map((x) => x.place)
            .join(', ')}`
        );
      if (body.priceyTop5?.length)
        bullets.push(
          `• 고가: ${body.priceyTop5
            .slice(0, 2)
            .map((x) => x.place)
            .join(', ')}`
        );
      cleaned = bullets.join('\n');
    }
    if (!/^[-•]/.test(cleaned))
      cleaned = cleaned
        .replace(/(^|\n)\s*/g, (m) => (m ? '\n• ' : '• '))
        .trim();

    res.status(200).json({ text: cleaned });
  } catch (err: any) {
    res
      .status(500)
      .json({ message: 'Server error', detail: String(err?.message || err) });
  }
}
