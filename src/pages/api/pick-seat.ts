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

// 응답의 Date 헤더(GMT)를 서울 시각으로. 로컬 시계를 안 믿으려고 서버 시간을 쓴다.
// dayjs(헤더).hour() 는 프로세스 타임존을 따르므로(Vercel=UTC) 반드시 명시할 것.
export const 서울시각 = (dateHeader: string | null) =>
  dayjs(dateHeader ?? undefined).tz('Asia/Seoul');

// checkIn 응답은 배치 형식이라 [{ result: ... }] 또는 [{ error: { message } }] 로 온다.
// 실패해도 HTTP 는 200 이므로 본문을 봐야 안다.
// 좌석은 자정에 그날 것이 열린다. 단축어가 폰 시계로 00:00:00 에 부르는데
// pickseat 서버가 미묘하게 느리면(23:59:5x) 아직 어제라 좌석이 안 열려 있거나
// 어제 날짜로 잡힐 수 있다. 그래서 판단 기준을 폰/Vercel 이 아니라 pickseat 서버
// 시각으로 두고, 자정 직전이면 넘어갈 때까지만 잠깐 기다린다.
//
// 기다림은 상한을 둔다. 서버리스 실행 시간이 있으니 몇 초 이상은 기다리지 않고,
// 그보다 멀면 그냥 진행한다(자정 실행이 아니라 낮에 수동으로 부른 경우).
export const 자정까지남은ms = (서버시간: dayjs.Dayjs, 최대대기ms: number) => {
  const 남은 = 서버시간.endOf('day').diff(서버시간) + 300; // 자정 넘긴 직후로 여유
  return 남은 > 0 && 남은 <= 최대대기ms ? 남은 : 0;
};

export const 예약에러찾기 = (json: unknown): string | null => {
  const rows = Array.isArray(json) ? json : [json];
  for (const r of rows) {
    const msg = (r as any)?.error?.message;
    if (msg) return String(msg).replace(/^\[GraphQL\]\s*/, '');
  }
  return null;
};

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
    const 스케줄조회 = async (yearMonth: string) => {
      const input = {
        1: { yearMonth },
        2: {
          user: { id: { _eq: userId } },
          yearMonth: { _eq: yearMonth },
        },
      };
      const r = await fetch(
        `https://pickseat.purple.io/api/trpc/scheduleForMain,dashboard,getScheduleMonthlyByUser?batch=1&input=${encodeURIComponent(
          JSON.stringify(input)
        )}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      // 판단 기준은 우리 시계가 아니라 pickseat 서버 시계다.
      return { json: await r.json(), 서버시간: 서울시각(r.headers.get('date')) };
    };

    let { json, 서버시간 } = await 스케줄조회(
      dayjs().tz('Asia/Seoul').format('YYYY-MM')
    );

    // 서버가 아직 자정을 안 넘겼으면 넘어갈 때까지만 기다렸다가 다시 받는다.
    // (월말이면 yearMonth 도 바뀌므로 재조회가 맞다)
    const 최대대기ms = Number(process.env.PICKSEAT_MAX_WAIT_MS || 8000);
    const 대기ms = 자정까지남은ms(서버시간, 최대대기ms);
    if (대기ms > 0) {
      console.log(`서버가 아직 ${서버시간.format('HH:mm:ss')} — ${대기ms}ms 대기`);
      await new Promise((r) => setTimeout(r, 대기ms));
      ({ json, 서버시간 } = await 스케줄조회(서버시간.add(대기ms, 'ms').format('YYYY-MM')));
    }

    // 이 값이 "오늘"의 기준. Vercel 시계도 폰 시계도 아니다.
    const 기준일 = 서버시간.format(dateFormat);
    console.log('서버 기준 오늘:', 기준일, 서버시간.format('HH:mm:ss'));

    const officeDates: string[] = json?.[2]?.result?.data?.[0]?.officeDates;
    const dayOffDates: string[] = json?.[2]?.result?.data?.[0]?.dayOffDates;

    if (officeDates === undefined) {
      throw new Error('출근일 데이터 가져오기 실패.');
    }

    const 오늘출근일임 = officeDates
      .filter((day) => !(dayOffDates || []).includes(day))
      .includes(기준일);
    if (!오늘출근일임) {
      return res.status(200).json({
        ok: false,
        error: '오늘 출근일이 아닙니다.',
        runAt: 기준일,
        serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
        waitedMs: 대기ms,
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

    // pickseat 은 실패해도 HTTP 200 에 error 를 담아 돌려준다.
    // 그걸 그대로 감싸서 ok:true 로 내보내면, 남이 먼저 앉은 날 크론이
    // 조용히 실패하고 성공으로 기록된다. 에러가 있으면 그대로 드러낸다.
    const 예약에러 = 예약에러찾기(reserveJson);
    if (예약에러) {
      return res
        .status(200)
        .json({
          ok: false,
          error: 예약에러,
          seatId,
          runAt: 기준일,
          serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
          waitedMs: 대기ms,
          data: reserveJson,
        });
    }

    return res.status(200).json({
      ok: true,
      seatId,
      runAt: 기준일,
      serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
      waitedMs: 대기ms,
      data: reserveJson,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
