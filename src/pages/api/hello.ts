// 카드 결제 문자 수신 웹훅. 문자 전달 앱이 원문을 여기로 POST 한다.
import type { NextApiRequest, NextApiResponse } from 'next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { 초로, 코어타임 } from '../../lib/usage-filter';

dayjs.extend(utc);
dayjs.extend(timezone);

// Vercel 무료 티어라 점심시간대 로그가 금방 밀려 못 본다.
// 그래서 수신 원문과 처리 결과를 시트의 로그 탭에 직접 남긴다.
// 파싱이 깨져도 원문은 남으므로 나중에 손으로 복구할 수 있다.
// (2026-08-05 취소 문자 한 건이 통째로 유실됐는데 원인을 확인할 방법이 없어서 붙였다)
// LOG_ENDPOINT가 설정되기 전에는 아무것도 보내지 않는다.
// Apps Script에 log 분기가 없는 상태로 보내면 로그가 결제 데이터로 오인돼
// 시트에 빈 행이 쌓인다. 분기를 먼저 넣고 나서 환경변수를 채울 것.
const 로그남기기 = async (기록: {
  결과: '성공' | '실패' | '무시';
  원문: string;
  비고?: string;
}) => {
  const endpoint = process.env.LOG_ENDPOINT;
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        type: 'log',
        createdAt: dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'),
        결과: 기록.결과,
        원문: 기록.원문,
        비고: 기록.비고 || '',
      }),
    });
  } catch (err) {
    // 로그 전송이 실패해도 본 처리를 막지는 않는다
    console.log('로그 전송 실패', err);
  }
};

// 이 엔드포인트는 무인증이라 아무나 가짜 결제 문자를 밀어 넣을 수 있었다.
// INGEST_SECRET을 넣으면 그때부터 검사한다 — 문자 전달 앱의 URL을 먼저 고치고
// 환경변수를 채워야 수신이 안 끊긴다. (LOG_ENDPOINT를 붙일 때와 같은 순서)
const 시크릿확인 = (req: NextApiRequest) => {
  const 기대값 = process.env.INGEST_SECRET;
  if (!기대값) return true;
  const 받은값 =
    (req.headers['x-ingest-secret'] as string | undefined) ||
    (req.query.key as string | undefined) ||
    '';
  return 받은값 === 기대값;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const 원문 =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);

  if (!시크릿확인(req)) {
    res.status(401).json({ message: '인증 실패' });
    return;
  }

  try {
    await 처리(req, res, 원문);
  } catch (err) {
    // 파싱 단계에서 터져도 원문은 남긴다 — 이게 없으면 문자가 통째로 증발한다
    const 메시지 = err instanceof Error ? err.message : String(err);
    console.log('처리 실패', 메시지);
    await 로그남기기({ 결과: '실패', 원문, 비고: 메시지 });
    if (!res.writableEnded) {
      res.status(500).json({ message: 메시지 });
    }
  }
}

async function 처리(
  req: NextApiRequest,
  res: NextApiResponse<any>,
  원문: string
) {
  const testMessage = [
    '[Web발신]\n[MY COMPANY] 승인\r\n8713 김지환님\r\n16,750원 일시불\r\n오늘은닭\r\n잔여한도: 476,000원',
    '[Web발신]\n[MY COMPANY] 승인\r\n8713 김지환님\r\n07/23 12:38\r\n16,750원 일시불\r\n오늘은닭',
  ];
  const testMode = '잔여한도포함'; // 잔여한도포함, 잔여한도미포함
  const isDev = process.env.NODE_ENV === 'development';
  const mock = {
    test: testMode === '잔여한도포함' ? testMessage[0] : testMessage[1],
  };
  const mes = isDev ? mock : req.body;
  console.log('리퀘스트', req.body);
  const parseWithLine: string[] = mes.test
    .replaceAll('\r', '')
    .replaceAll('님', '')
    .replaceAll(',', '')
    .split('\n');
  const 잔여한도포함 = parseWithLine.some((line) => line.includes('잔여한도'));

  const confirmType = parseWithLine[1].split(' ')[2];
  const cardNumber = parseWithLine[2].split(' ')[0];
  const user = parseWithLine[2].split(' ')[1];
  const date = 잔여한도포함
    ? dayjs().tz('Asia/Seoul').format('MM/DD')
    : parseWithLine[3].split(' ')[0];
  const time = 잔여한도포함
    ? dayjs().tz('Asia/Seoul').format('HH:mm:ss')
    : parseWithLine[3].split(' ')[1];
  const fee = 잔여한도포함
    ? parseWithLine[3].split(' ')[0].replaceAll('원', '')
    : parseWithLine[4].split(' ')[0].replaceAll('원', '');
  const place = 잔여한도포함 ? parseWithLine[4] : parseWithLine[5];

  // 조회 필터와 같은 기준을 쓴다. 예전엔 여기만 문자열 비교로 15시 컷이었는데,
  // 그러면 15~16시 결제는 시트에 아예 안 들어가면서 조회상으로는 지원 대상이라
  // 조용히 사라졌고, '9:21' 처럼 시가 한 자리면 비교 자체가 뒤집혔다.
  if (초로(time) >= 코어타임.끝초) {
    await 로그남기기({ 결과: '무시', 원문, 비고: `점심시간 아님 (${time})` });
    res.status(200).json({ message: '점심시간이 아닙니다.' });
    return;
  }

  const 올해 = dayjs().format('YYYY');
  const param = {
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    confirmType,
    cardNumber,
    user,
    date: dayjs(`${올해}/${date}`).format('YYYY-MM-DD'),
    time: dayjs(`${올해}/${date} ${time}`).format('HH:mm:ss'),
    fee: parseInt(fee),
    place,
  };

  console.log('파싱결과', param);
  if (isDev) {
    res.status(200).json(param);
    return;
  }

  try {
    const response = await fetch(process.env.API_ENDPOINT || '', {
      method: 'POST',
      body: JSON.stringify(param),
    });
    const data = await response.json();

    if (data?.message === '성공') {
      // 예전엔 캐시에 직접 한 줄 밀어 넣었는데, 시트가 매기는 id가 없어서
      // 그 줄만 제외 버튼도 안 먹고 React key도 비었다. 그냥 캐시를 만료시켜
      // 다음 조회 때 시트에서 id까지 온전히 받아오게 한다.
      global.cachedAt = 0;
      await 로그남기기({
        결과: '성공',
        원문,
        비고: `${confirmType} ${cardNumber} ${user} ${fee}원 ${place}`,
      });
    } else {
      // 시트가 저장을 못 했는데 200으로 넘어가면 문자가 조용히 사라진다
      await 로그남기기({
        결과: '실패',
        원문,
        비고: `시트 응답: ${JSON.stringify(data)}`,
      });
    }
    res.status(200).json(param);
  } catch (err) {
    console.log(err);
    await 로그남기기({
      결과: '실패',
      원문,
      비고: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json(param);
  }
}
