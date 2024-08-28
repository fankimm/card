// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

type Data = {
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
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );
  console.log(req.query.name);
  try {
    const { data, error } = await supabase
      .from('card-usages')
      .select('fee, date')
      .gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))
      .lte('date', dayjs().endOf('month').format('YYYY-MM-DD'))
      .not('fee', 'is', null)
      .eq('confirmType', '승인')
      .eq('user', req.query.name);
    if (data) {
      console.log('data', data);
      res.status(200).json({
        message: '성공',
        data: data.reduce((a, b) => a + b.fee, 0),
      });
    } else if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      res.status(500).json({ message: err.message || '에러발생' });
    }
  }
}
