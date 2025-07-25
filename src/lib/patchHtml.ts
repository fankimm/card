// lib/patchHtml.ts
import * as cheerio from 'cheerio';

import { URL } from 'url';

const ATTRIBUTES = ['href', 'src', 'action'];

export function patchHtml(html: string, baseUrl: string) {
  const $ = cheerio.load(html);

  ATTRIBUTES.forEach((attr) => {
    // 모든 태그의 해당 속성을 대상으로
    $(`[${attr}]`).each((_, el) => {
      const val = $(el).attr(attr);
      if (!val) return;

      // 절대 URL인 경우는 무시 (http:// 또는 https://)
      if (/^https?:\/\//.test(val)) return;

      try {
        const resolved = new URL(val, baseUrl).toString();
        const encoded = encodeURIComponent(resolved);
        $(el).attr(attr, `/api/proxy?url=${encoded}`);
      } catch (err) {
        console.warn(`URL 파싱 실패: ${val}`, err);
      }
    });
  });

  return $.html();
}
