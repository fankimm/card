import type { NextApiRequest, NextApiResponse } from 'next';
// import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { getData } from './get-total-fee';
import { isSameUser } from '../../lib/user-match';
import { 취소상쇄, 점심지원대상 } from '../../lib/usage-filter';

type CachedDataType = {
  confirmType: string;
  cardNumber?: string;
  place?: string;
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
  const card = req.query.card as string;
  try {
    await getData();
    const data = global.cachedData;
    const 내역 = (data || [])
      .filter((item) => isSameUser(item, user, card))
      .filter((item) => dayjs(item.date).isSame(dayjs(date), 'month'));
    const temp = 취소상쇄(내역)
      .filter(점심지원대상)
      .sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      );
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
