// 데이터 조회 api
import type { NextApiRequest, NextApiResponse } from 'next';
// import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import util from 'util';
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
      myData: {
        instanceId?: string;
      };
    }
  }
}

console.log('--- 서버시작 ---');
console.log('현재시간', dayjs().format('YYYY-MM-DD HH:mm:ss'));
export const getData = async () => {
  try {
    const cachedData = (global as unknown as NodeJS.Global).cachedData;
    if (!cachedData) {
      console.log('캐시없음');
      const response = await fetch(process.env.API_ENDPOINT || '');
      const data = (await response.json()) as { data: Data[] };
      (global as any).cachedData = data.data as Data[];
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
  const data = (global as unknown as NodeJS.Global).cachedData as Data[];
  const 전체데이터 = data;
  const 리스트데이터 = data
    ?.map((item) => {
      if (item.confirmType === '취소') {
        return {
          ...item,
          fee: -parseInt(item.fee),
        };
      }
      return item;
    })
    .filter((item) => item.user.trim() === user.trim())
    .filter((item) => {
      return dayjs(item.date).isSame(dayjs(date), 'month');
    })
    .filter((item) => item.time > '10:00:00' && item.time < '16:00:00')
    .filter((item) => parseInt(item.fee.toString(), 0) <= 20000);
  const 집계용데이터 = 리스트데이터.filter(
    (item) => item.confirmType !== '취소'
  );
  const total = 집계용데이터.reduce(
    (a, b) => a + parseInt(b.fee.toString()),
    0
  );
  const totalLength = 집계용데이터.length;
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
