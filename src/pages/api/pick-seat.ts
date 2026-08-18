// 좌석 자동 예약. 크론에서 부른다.
//
// 예전엔 이름·passcode·좌석번호가 소스에 박혀 있었고 인증도 없어서,
// URL만 알면 아무나 남의 이름으로 좌석을 잡을 수 있었다. 전부 환경변수로 옮기고
// CRON_SECRET 검사를 붙였다. (박혀 있던 passcode는 깃 히스토리에 남아 있으니 바꿀 것)
import dayjs from 'dayjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse as parseSetCookie } from 'set-cookie-parser';

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
dayjs.extend(utc);
dayjs.extend(timezone);

declare module 'dayjs' {
  interface Dayjs {
    tz(timezone: string): Dayjs;
  }
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const 시크릿 = process.env.CRON_SECRET;
  if (시크릿) {
    const 받은값 =
      (req.headers['x-cron-secret'] as string | undefined) ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      (req.query.key as string | undefined) ||
      '';
    if (받은값 !== 시크릿) {
      return res.status(401).json({ ok: false, error: '인증 실패' });
    }
  }

  const name = process.env.PICKSEAT_NAME;
  const passcode = process.env.PICKSEAT_PASSCODE;
  const userId = process.env.PICKSEAT_USER_ID;
  const seatId = Number(process.env.PICKSEAT_SEAT_ID);
  if (!name || !passcode || !userId || !seatId) {
    return res.status(500).json({
      ok: false,
      error:
        'PICKSEAT_NAME / PICKSEAT_PASSCODE / PICKSEAT_USER_ID / PICKSEAT_SEAT_ID 가 필요합니다',
    });
  }

  try {
    const dateFormat = 'YYYY-MM-DD';
    const now = dayjs().tz('Asia/Seoul');
    console.log('현재 시간:', now.format('YYYY-MM-DD HH:mm:ss Z'));

    const yearMonth = now.format(dateFormat).slice(0, 7); // "2025-05"
    const input = {
      1: { yearMonth },
      2: {
        user: { id: { _eq: userId } },
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

    const officeDates: string[] = json?.[2]?.result?.data?.[0]?.officeDates;
    const dayOffDates: string[] = json?.[2]?.result?.data?.[0]?.dayOffDates;

    if (officeDates === undefined) {
      throw new Error('출근일 데이터 가져오기 실패.');
    }

    const 오늘출근일임 = officeDates
      .filter((day) => !(dayOffDates || []).includes(day))
      .includes(now.format(dateFormat));
    if (!오늘출근일임) {
      return res.status(200).json({
        ok: false,
        error: '오늘 출근일이 아닙니다.',
        runAt: now.format(dateFormat),
      });
    }

    const csrfRes = await fetch('https://pickseat.purple.io/api/auth/csrf', {
      headers: { 'User-Agent': UA },
    });

    const csrfToken = (await csrfRes.json()).csrfToken;
    const cookiesForLogin = csrfRes.headers.get('set-cookie') ?? ''; // csrf 쿠키 포함

    const form = new URLSearchParams();
    form.append('name', name);
    form.append('passcode', passcode);
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
          'User-Agent': UA,
        },
        body: form.toString(),
      }
    );

    const cookiesForCheckIn = loginRes.headers.getSetCookie();
    if (!cookiesForCheckIn?.length) {
      throw new Error('로그인 후 쿠키가 없습니다.');
    }
    const parsedCookies = parseSetCookie(cookiesForCheckIn);

    const sessionToken = parsedCookies.find(
      (c) => c.name === '__Secure-next-auth.session-token'
    )?.value;
    if (!sessionToken) {
      throw new Error('세션 토큰을 찾지 못했습니다.');
    }

    const reserveRes = await fetch(
      'https://pickseat.purple.io/api/trpc/checkIn?batch=1',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Origin: 'https://pickseat.purple.io',
          Referer: 'https://pickseat.purple.io/seat',
          'User-Agent': UA,
          Cookie: `__Secure-next-auth.session-token=${sessionToken}`, // 중요!
        },
        body: JSON.stringify({ '0': { seatId } }),
      }
    );
    const reserveJson = await reserveRes.json();

    return res.status(200).json({ ok: true, data: reserveJson });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
