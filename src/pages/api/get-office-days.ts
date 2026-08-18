// 좌석 예약 시스템에서 이번 달 출근일을 가져온다(연차 제외).
import type { NextApiRequest, NextApiResponse } from 'next';
import { 요청자확인 } from '../../lib/auth';

const BASE = 'https://pickseat.purple.io/api/trpc';

type ResponseData = {
  message: string;
  timestamp: number;
  data: string[];
};

const trpc = async (path: string, input: unknown) => {
  const url = `${BASE}/${path}?batch=1&input=${encodeURIComponent(
    JSON.stringify(input)
  )}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`좌석 시스템 응답 ${res.status}`);
  return res.json();
};

const getId = async (name: string) => {
  const json = await trpc('isUser', { 0: { name } });
  const id = json?.[0]?.result?.data?.[0]?.id;
  if (!id) throw new Error(`좌석 시스템에서 '${name}' 을 찾지 못했습니다`);
  return id as string;
};

const 출근정보얻기 = async (id: string, yearMonth: string) => {
  const json = await trpc(
    'scheduleForMain,dashboard,getScheduleMonthlyByUser',
    {
      1: { yearMonth },
      2: { user: { id: { _eq: id } }, yearMonth: { _eq: yearMonth } },
    }
  );
  const row = json?.[2]?.result?.data?.[0];
  if (!row) throw new Error('출근일 데이터를 받지 못했습니다');
  return {
    officeDays: (row.officeDates || []) as string[],
    offDays: (row.dayOffDates || []) as string[],
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | { message: string }>
) {
  // 이름만 알면 남의 출근일·연차가 나오던 엔드포인트다. 신원은 세션에서 받는다.
  const who = 요청자확인(req, res);
  if (!who) return;
  const name = who.name;

  // 예전엔 이 값을 dayjs().format(date) 에 넣었다. '2026-08' 에는 치환할 토큰이
  // 없어서 우연히 그대로 통과했을 뿐, 알파벳이 섞이면 조용히 엉뚱한 달을 조회한다.
  const yearMonth = ((req.query.date as string) || '').trim();

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    res.status(400).json({ message: "date 는 'YYYY-MM' 형식이어야 합니다" });
    return;
  }

  try {
    const id = await getId(name);
    const 출근정보 = await 출근정보얻기(id, yearMonth);
    const 출근일 = 출근정보.officeDays
      .filter((i) => !출근정보.offDays.includes(i))
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      message: 'SUCCESS',
      timestamp: Date.now(),
      data: 출근일,
    });
  } catch (err) {
    // 예전엔 여기서 그냥 던져서 Next가 HTML 500을 돌려줬고,
    // 클라이언트의 .then(res => res.json()) 이 파싱하다 터졌다(catch도 없었다).
    console.log('출근일 조회 실패', err);
    res
      .status(502)
      .json({ message: err instanceof Error ? err.message : '조회 실패' });
  }
}
