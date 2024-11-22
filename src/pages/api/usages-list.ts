import type { NextApiRequest, NextApiResponse } from 'next';
// import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { getData } from './hello2';

type CachedDataType = {
  confirmType: string;
  fee: string;
  user: string;
  date: string;
  time: string;
};

declare global {
  var cachedData: CachedDataType[];
}

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
  try {
    await getData();
    const data = global.cachedData;
    const temp = data
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
      .filter((item) => item.time > '10:00:00' && item.time < '16:00:00');
    console.log('temp 한건', temp?.[0]);
    res.status(200).json(temp);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message || '에러발생' });
    }
  }
  // supabase 로직
  // try {
  //   const { data, error } = await supabase
  //     .from('card-usages')
  //     .select()
  //     .eq('user', req.query.name as string)
  //     .gte('date', dayjs(date).startOf('month').format('YYYY-MM-DD'))
  //     .lte('date', dayjs(date).endOf('month').format('YYYY-MM-DD'));
  //   if (data) {
  //     res.status(200).json(data);
  //   } else {
  //     throw new Error(error.message);
  //   }
  // } catch (error) {
  //   if (error instanceof Error) {
  //     res.status(500).json({ message: error.message || '에러발생' });
  //   }
  // }
}
