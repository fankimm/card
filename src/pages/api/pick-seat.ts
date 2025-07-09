import dayjs from 'dayjs';
import { Cookie } from './../../../node_modules/@types/ws/node_modules/undici-types/cookies.d';
import type { NextApiRequest, NextApiResponse } from 'next';
import setCookieParser from 'set-cookie-parser';

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
dayjs.extend(utc);
dayjs.extend(timezone);

declare module 'dayjs' {
  interface Dayjs {
    tz(timezone: string): Dayjs;
  }
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const dateFormat = 'YYYY-MM-DD';
    const now = dayjs().tz('Asia/Seoul');
    console.log('현재 시간:', now.format('YYYY-MM-DD HH:mm:ss Z'));

    const yearMonth = now.format(dateFormat).slice(0, 7); // "2025-05"
    const input = {
      1: { yearMonth },
      2: {
        user: { id: { _eq: '4bffabe0-a5e4-4813-a45f-ae5aaf1f088a' } },
        yearMonth: { _eq: yearMonth },
      },
    };

    const 출근일체크res = await fetch(
      `https://pickseat.purple.io/api/trpc/scheduleForMain,dashboard,getScheduleMonthlyByUser?batch=1&input=${encodeURIComponent(
        JSON.stringify(input)
      )}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    const 서버시간 = dayjs(출근일체크res.headers.get('date'));
    const 시 = 서버시간.hour();
    if (시 < 12) {
      const result = {
        success: true,
        canProceed: false,
        reason: '아직 12시 전이라 실행 안 함',
        serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
      };
      console.log('result:', result);
      return res.status(200).json(result);
    }
    const json = await 출근일체크res.json();

    console.log('출근일체크 결과:', JSON.stringify(json, null, 2));

    const officeDates: string[] = json?.[2]?.result?.data?.[0]?.officeDates;
    if (officeDates === undefined) {
      throw new Error('출근일 데이터 가져오기 실패.');
    }
    console.log('실행일:', now.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('출근일 목록:', officeDates);
    const 오늘출근일임 = officeDates.includes(now.format(dateFormat));
    if (!오늘출근일임) {
      return res.status(200).json({
        ok: false,
        error: '오늘 출근일이 아닙니다.',
        runAt: now.toISOString().slice(0, 10),
        officeDates,
      });
    }
    const csrfRes = await fetch('https://pickseat.purple.io/api/auth/csrf', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      },
    });

    const csrfToken = (await csrfRes.json()).csrfToken;
    const cookiesForLogin = csrfRes.headers.get('set-cookie') ?? ''; // csrf 쿠키 포함

    const form = new URLSearchParams();
    form.append('name', '김지환');
    form.append('passcode', '2406');
    form.append('csrfToken', csrfToken);
    form.append('callbackUrl', '/');
    form.append('redirect', 'false');
    form.append('json', 'true');

    const loginRes = await fetch(
      'https://pickseat.purple.io/api/auth/callback/simple-login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookiesForLogin, // csrf 쿠키 반드시 포함
          Origin: 'https://pickseat.purple.io',
          Referer:
            'https://pickseat.purple.io/login?callbackUrl=https%3A%2F%2Fpickseat.purple.io%2F',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        },
        body: form.toString(),
      }
    );

    // 3. 로그인 후 쿠키 확인
    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('로그인 후 쿠키가 없습니다.');
    }
    // 쿠키 파싱
    // const cookies = setCookieHeader
    //   .split(',')
    //   .map((c) => c.split(';')[0])
    //   .join('; ');

    // 4. 예약 API 호출 (seatId는 원하는 좌석 ID로 바꿔야 함)
    const cookiesForCheckIn = loginRes.headers.getSetCookie(); // node-fetch v3 이상
    const parsedCookies = setCookieParser.parse(cookiesForCheckIn) as Cookie[];

    const sessionToken = parsedCookies.find(
      (c) => c.name === '__Secure-next-auth.session-token'
    )?.value;

    const reserveRes = await fetch(
      'https://pickseat.purple.io/api/trpc/checkIn?batch=1',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Origin: 'https://pickseat.purple.io',
          Referer: 'https://pickseat.purple.io/seat',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          Cookie: `__Secure-next-auth.session-token=${sessionToken}`, // 중요!
        },
        body: JSON.stringify({
          '0': {
            seatId: 49,
          },
        }),
      }
    );
    const reserveJson = await reserveRes.json();

    // 예약 결과 반환
    return res.status(200).json({ ok: true, data: reserveJson });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
