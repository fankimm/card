// 데이터 조회 api
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

export type Data = {
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
};
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  // supabase 로직
  // const supabase = createClient(
  //   process.env.SUPABASE_URL || '',
  //   process.env.SUPABASE_ANON_KEY || ''
  // );
  const date = req.query.date as string;
  const user = req.query.name as string;
  console.log('user', user);
  try {
    const response = await fetch(process.env.API_ENDPOINT || '');
    const data = (await response.json()) as { data: Data[] };
    if (data) {
      const temp = data.data
        .map((item) => {
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
        .reduce((a, b) => a + parseInt(b.fee.toString()), 0);
      console.log('data 값 : ', temp);
      res.status(200).json({
        message: '성공',
        data: temp,
      });
    }
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      res.status(500).json({ message: err.message || '에러발생' });
    }
  }

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
