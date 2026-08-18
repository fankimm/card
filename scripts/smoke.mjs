// 프로덕션(또는 로컬) 스모크 테스트. 배포마다 돌린다.
//   node smoke.mjs [baseUrl]
import { chromium } from 'playwright-core';
const B = process.argv[2] || 'https://card-usages.vercel.app';
const NAME = '김지환', CARD = '9427';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.setDefaultTimeout(60000);

const body = () => page.evaluate(() => document.body.innerText);
// 렌더가 멎을 때까지(같은 본문 2연속 + 스켈레톤 0) 기다린다
const settle = async (max = 40) => {
  let prev = null;
  for (let i = 0; i < max; i++) {
    await page.waitForTimeout(700);
    const [t, sk] = await Promise.all([
      body(),
      page.evaluate(() => document.querySelectorAll('.skeleton').length),
    ]);
    if (sk === 0 && t === prev) return t;
    prev = t;
  }
  return prev;
};
const tab = async (icon) => {
  await page.click(`button:has(svg.lucide-${icon})`);
  return settle();
};
const clickText = async (t) => {
  await page.evaluate((x) => [...document.querySelectorAll('button')]
    .find((b) => b.innerText.trim() === x)?.click(), t);
  return settle();
};

const fail = [];
const check = (name, ok, detail = '') => {
  (ok ? 0 : fail.push(name));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// --- 로그인 전
await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('card-usages:김지환:allData', '[{"user":"남","cardNumber":"9999"}]'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
check('옛 캐시(:allData) 삭제',
  (await page.evaluate(() => Object.keys(localStorage).filter(k => k.endsWith(':allData')))).length === 0);

await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[placeholder="이름"]', NAME);
await page.fill('input[placeholder="카드 뒷 4자리"]', '12');
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);
check('카드 형식 검증',
  /4자리/.test(await page.evaluate(() => document.querySelector('.text-red-500')?.textContent || '')));

// --- 로그인
await page.fill('input[placeholder="카드 뒷 4자리"]', CARD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
const home = await settle();

const g = (l) => home.match(new RegExp(l + '\\s*\\n\\s*([^\\n]+)'))?.[1] ?? null;
const 금액 = g('총 사용금액'), 건수 = g('총 사용건수'), 평균 = g('건당 평균 금액');
check('재발급 카드 자동 인식',
  (await page.evaluate(() => localStorage.getItem('cardInfo')))?.includes(','),
  await page.evaluate(() => localStorage.getItem('cardInfo')));
check('홈 총 사용금액 렌더', /^[\d,]+원$/.test(금액 || ''), 금액);
check('홈 총 사용건수 렌더', /^\d+건$/.test(건수 || ''), 건수);
check('건당 평균 반올림(소수점 없음)', /^[\d,]+원$/.test(평균 || '') && !평균?.includes('.'), 평균);
check('남은 지원일수 렌더', /^\d+일$/.test(g('남은 지원일수') || ''), g('남은 지원일수'));
check('일평균 렌더', !!g('일평균 사용 가능 금액'), g('일평균 사용 가능 금액'));

// --- 월 이동
await page.click('button:has(svg.lucide-chevron-left)');
const 지난달 = await settle();
check('지난달 이동', /총 사용금액\s*\n\s*[\d,]+원/.test(지난달),
  지난달.match(/총 사용금액\s*\n\s*([^\n]+)/)?.[1]);
await page.click('button:has(svg.lucide-chevron-right)');
await settle();

// --- 통계
await tab('chart-no-axes-column');
const top5 = (t) => {
  const m = t.match(/최다 방문 Top 5\n([\s\S]*?)(최소 방문|$)/)?.[1] || '';
  const L = m.split('\n').filter(Boolean);
  return L.reduce((a, _, i) => (i % 2 === 0 && L[i + 1] ? a.concat(`${L[i]} ${L[i + 1]}`) : a), []).slice(0, 3);
};
const 전체 = top5(await clickText('전체 통계'));
const 내것 = top5(await clickText('내 통계'));
check('통계 전체 랭킹 렌더', 전체.length > 0, 전체.join(' / '));
check('통계 내 랭킹 렌더', 내것.length > 0, 내것.join(' / '));
// 전체 랭킹은 남의 내역까지 포함하므로 1위 방문수가 내 것보다 작을 수 없다.
// (데이터가 작으면 동점이 생겨 Top3 목록 자체는 같을 수 있다)
const 최다 = (a) => parseInt((a[0] || '').split(' ').pop() || '0', 10);
check('전체 랭킹 >= 내 랭킹', 최다(전체) >= 최다(내것), `${최다(전체)} vs ${최다(내것)}`);

// --- 추천 (탭 왕복해도 고정)
const r1 = await tab('utensils');
const pick = (t) => t.match(/(밸런스 추천|최애 픽|숨은 맛집|가성비 픽|보상 픽|오랜만 픽|랜덤 즐겨찾기)\n([^\n]+)/)?.[2];
const a1 = pick(r1);
check('추천 렌더', r1.includes('오늘의 점심 추천') && !!a1, a1);
const 왕복 = [];
for (let i = 0; i < 2; i++) { await tab('house'); 왕복.push(pick(await tab('utensils'))); }
check('추천이 탭 왕복에도 고정', 왕복.every((v) => v === a1), 왕복.join(','));

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fail.length ? 'FAILED: ' + fail.join(', ') : '전부 통과'}`);
await browser.close();
process.exit(fail.length ? 1 : 0);
