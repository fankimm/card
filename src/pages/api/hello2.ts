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
    'https://rrcfctexwghnswguaqcu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyY2ZjdGV4d2dobnN3Z3VhcWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE4ODU5NzAsImV4cCI6MjAzNzQ2MTk3MH0.VbLtQRkAr0HmB4OvVkfoet0VcRsBr9qDGDuILUFD9Ac'
  );
  try {
    const { data, error } = await supabase
      .from('card-usages')
      .select('fee, date')
      .gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))
      .lte('date', dayjs().endOf('month').format('YYYY-MM-DD'))
      .not('fee', 'is', null);
    if (data) {
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
