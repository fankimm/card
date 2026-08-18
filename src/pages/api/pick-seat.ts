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
// 자정을 노린 호출인데 기다리기엔 너무 이른 경우(예: 23:59:00 도착, 상한 25초).
// 그대로 진행하면 끝나가는 오늘 자리를 잡는데, 그건 아무 의미가 없다.
// 자정 10분 전부터는 차라리 안 잡고 이유를 알려준다.
export const 자정직전인가 = (서버시간: dayjs.Dayjs) =>
  서버시간.endOf('day').diff(서버시간) <= 10 * 60 * 1000;

export const 자정까지남은ms = (서버시간: dayjs.Dayjs, 최대대기ms: number) => {
  // Date 헤더는 초 단위라 서버의 실제 시각은 여기서 최대 1초 뒤일 수 있다.
  // 자정 직전에 쏘느니 조금 지나서 쏘는 게 안전하므로 250ms 여유를 둔다.
  const 남은 = 서버시간.endOf('day').diff(서버시간) + 250;
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
    // Date 헤더를 읽은 순간을 우리 시계로도 찍어둔다. 아래 준비 작업에 걸린
    // 시간만큼 빼고 자야 정확히 자정에 깬다.
    const 기준시각ms = Date.now();

    // 단축어는 자정 정각에 부른다. 폰이 서버보다 조금 빨라 23:59:xx 로 도착해도
    // 그냥 기다렸다 쏘도록 넉넉히 잡는다. maxDuration 60초 안에 충분히 들어간다.
    const 최대대기ms = Number(process.env.PICKSEAT_MAX_WAIT_MS || 40000);
    const 대기ms = 자정까지남은ms(서버시간, 최대대기ms);
    const 목표시각 = 서버시간.add(대기ms, 'ms');
    const 기준일 = 목표시각.format(dateFormat);
    console.log(
      `서버 ${서버시간.format('HH:mm:ss')} → 목표 ${기준일}, 대기 ${대기ms}ms`
    );

    if (대기ms === 0 && 자정직전인가(서버시간)) {
      const 남은초 = Math.ceil(서버시간.endOf('day').diff(서버시간) / 1000);
      return res.status(200).json({
        ok: false,
        error: `자정까지 ${남은초}초 남았습니다. 대기 상한(${최대대기ms}ms)보다 멀어서, 끝나가는 오늘 자리를 잡지 않고 종료합니다. 더 늦게 호출하거나 PICKSEAT_MAX_WAIT_MS 를 늘리세요.`,
        runAt: null,
        serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
        waitedMs: 0,
      });
    }

    // 월이 바뀌는 자정(8/31 → 9/1)이면 다음 달 스케줄이 필요하다. 대기 전에 미리.
    if (목표시각.format('YYYY-MM') !== 서버시간.format('YYYY-MM')) {
      ({ json } = await 스케줄조회(목표시각.format('YYYY-MM')));
    }

    const officeDates: string[] = json?.[2]?.result?.data?.[0]?.officeDates;
    const dayOffDates: string[] = json?.[2]?.result?.data?.[0]?.dayOffDates;
    if (officeDates === undefined) {
      throw new Error('출근일 데이터 가져오기 실패.');
    }

    const 오늘출근일임 = officeDates
      .filter((day) => !(dayOffDates || []).includes(day))
      .includes(기준일);
    if (!오늘출근일임) {
      // 출근일이 아니면 기다릴 이유가 없다
      return res.status(200).json({
        ok: false,
        error: '오늘 출근일이 아닙니다.',
        runAt: 기준일,
        serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
        waitedMs: 0,
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

    // ── 여기까지가 준비. 인증은 자정 전에 끝내둔다. ──
    // 예전엔 자정이 지난 뒤에야 스케줄→csrf→로그인→checkIn 을 순차로 했다.
    // 왕복 4번이라 실제 예약이 0.8~1.3초 늦게 도착했다. 같은 자리를 노리는
    // 사람이 미리 준비하고 정각에 쏘면 그만큼 밀린다.
    // 이제 남은 건 checkIn 한 번뿐이다.
    let 실제대기ms = 0;
    if (대기ms > 0) {
      실제대기ms = Math.max(0, 기준시각ms + 대기ms - Date.now());
      if (실제대기ms > 0) {
        await new Promise((r) => setTimeout(r, 실제대기ms));
      }
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
          waitedMs: Math.round(실제대기ms),
          data: reserveJson,
        });
    }

    return res.status(200).json({
      ok: true,
      seatId,
      runAt: 기준일,
      serverTime: 서버시간.format('YYYY-MM-DD HH:mm:ss'),
      waitedMs: Math.round(실제대기ms),
      data: reserveJson,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
