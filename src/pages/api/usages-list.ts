// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );
  try {
    const { data, error } = await supabase
      .from('card-usages')
      .select()
      .eq('user', req.query.name as string)
      .gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))
      .lte('date', dayjs().endOf('month').format('YYYY-MM-DD'));
    if (data) {
      res.status(200).json(data);
    } else {
      throw new Error(error.message);
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message || '에러발생' });
    }
  }
}
