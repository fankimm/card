import dayjs from 'dayjs';
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
  timestamp: number;
  data: string[];
};

const getId = async (name: string) => {
  const input = {
    0: { name },
  };

  const url = `https://pickseat.purple.io/api/trpc/isUser?batch=1&input=${encodeURIComponent(
    JSON.stringify(input)
  )}`;

  const idResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 필요 시 인증 쿠키를 여기에 추가할 수 있음
      // "Cookie": "__Secure-next-auth.session-token=YOUR_TOKEN_HERE"
    },
  });
  const idResponseJson = await idResponse.json();
  const id = idResponseJson[0].result.data[0].id;
  return id;
};
const 출근정보얻기 = async (id: string, date: string) => {
  const input = {
    1: { yearMonth: dayjs().format(date) },
    2: {
      user: {
        id: { _eq: id },
      },
      yearMonth: { _eq: dayjs().format(date) },
    },
  };

  const url = `https://pickseat.purple.io/api/trpc/scheduleForMain,dashboard,getScheduleMonthlyByUser?batch=1&input=${encodeURIComponent(
    JSON.stringify(input)
  )}`;

  const 출근정보리스폰스 = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 쿠키가 필요한 경우 아래 주석을 해제하거나 credentials: 'include' 사용
      // "Cookie": "__Secure-next-auth.session-token=your_token_here"
    },
    // credentials: "include"  // ← 브라우저에서 세션 쿠키 자동 포함시킴
  });
  const 출근정보JSON = await 출근정보리스폰스.json();
  console.log(출근정보JSON);
  const result = {
    officeDays: 출근정보JSON[2].result.data[0].officeDates,
    offDays: 출근정보JSON[2].result.data[0].dayOffDates,
  };
  return result;
};

interface 출근정보타입 {
  officeDays: string[];
  offDays: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const name = req.query.name as string;
  const date = req.query.date as string;
  const id = await getId(name);
  console.log('id', id);
  const 출근정보: 출근정보타입 = await 출근정보얻기(id, date);
  const 출근일 = 출근정보.officeDays
    .filter((i) => !출근정보.offDays.includes(i))
    .sort((a, b) => a.localeCompare(b));
  console.log('officeDays', 출근정보);

  res.status(200).json({
    message: 'SUCCESS',
    timestamp: Date.now(),
    data: 출근일,
  });
}
