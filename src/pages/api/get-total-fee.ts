// 데이터 조회 api
import type { NextApiRequest, NextApiResponse } from 'next';
// import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import util from 'util';
import { isSameUser } from '../../lib/user-match';
import { 취소상쇄, 점심지원대상 } from '../../lib/usage-filter';
export interface Data {
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

declare global {
  namespace NodeJS {
    interface Global {
      cachedData?: Data[];
      cachedAt?: number;
      myData: {
        instanceId?: string;
      };
    }
  }
}

console.log('--- 서버시작 ---');
console.log('현재시간', dayjs().format('YYYY-MM-DD HH:mm:ss'));

// 캐시를 무기한 들고 있으면 인스턴스가 살아있는 동안 새 결제가 영영 안 보인다.
// 3분 지나면 다시 받아온다.
const CACHE_TTL_MS = 3 * 60 * 1000;

export const getData = async () => {
  try {
    const g = global as unknown as NodeJS.Global;
    const 만료 = !g.cachedAt || Date.now() - g.cachedAt > CACHE_TTL_MS;
    if (!g.cachedData || 만료) {
      console.log(g.cachedData ? '캐시만료' : '캐시없음');
      const response = await fetch(process.env.API_ENDPOINT || '');
      const data = (await response.json()) as { data: Data[] };
      (global as any).cachedData = data.data as Data[];
      (global as any).cachedAt = Date.now();
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(err.message);
    }
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  await getData();
  const date = req.query.date as string;
  const user = req.query.name as string;
  const card = req.query.card as string;
  const data = (global as unknown as NodeJS.Global).cachedData as Data[];
  const 전체데이터 = data;
  // 취소 상쇄를 금액·시간 필터보다 먼저 해야 한다.
  // 2만원 넘는 결제를 취소한 경우, 먼저 걸러버리면 짝을 못 찾아 취소가 붕 뜬다.
  const 내역 = (data || [])
    .filter((item) => isSameUser(item, user, card))
    .filter((item) => dayjs(item.date).isSame(dayjs(date), 'month'));
  const 리스트데이터 = 취소상쇄(내역)
    .filter(점심지원대상)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const total = 리스트데이터.reduce(
    (a, b) => a + parseInt(b.fee.toString()),
    0
  );
  const totalLength = 리스트데이터.length;
  res.status(200).json({
    message: '성공',
    data: total,
    length: totalLength,
    originData: 리스트데이터,
    allData: 전체데이터,
  });

  // supabase 로직
  // const supabase = createClient(
  //   process.env.SUPABASE_URL || '',
  //   process.env.SUPABASE_ANON_KEY || ''
  // );

  // 슈퍼베이스 로직
  // try {
  //   const { data, error } = await supabase
  //     .from('card-usages')
  //     .select('fee, date, confirmType')
  //     .gte('date', dayjs(date).startOf('month').format('YYYY-MM-DD'))
  //     .lte('date', dayjs(date).endOf('month').format('YYYY-MM-DD'))
  //     .not('fee', 'is', null)
  //     .eq('user', req.query.name);
  //   if (data) {
  //     console.log('data', data);
  //     res.status(200).json({
  //       message: '성공',
  //       data: data
  //         .map((item) => {
  //           if (item.confirmType === '취소') {
  //             return {
  //               ...item,
  //               fee: -parseInt(item.fee),
  //             };
  //           }
  //           return item;
  //         })
  //         .reduce((a, b) => a + b.fee, 0),
  //     });
  //   } else if (error) {
  //     throw new Error(error.message);
  //   }
  // } catch (err) {
  //   console.log(err);
  //   if (err instanceof Error) {
  //     res.status(500).json({ message: err.message || '에러발생' });
  //   }
  // }
}
