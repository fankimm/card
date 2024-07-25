// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const supabase = createClient(
    'https://rrcfctexwghnswguaqcu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyY2ZjdGV4d2dobnN3Z3VhcWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE4ODU5NzAsImV4cCI6MjAzNzQ2MTk3MH0.VbLtQRkAr0HmB4OvVkfoet0VcRsBr9qDGDuILUFD9Ac'
  );

  //const mes = '[Web발신]\n[MY COMPANY] 승인\r\n8713 김지환님\r\n07/23 12:38\r\n16,750원 일시불\r\n오늘은닭'
  const mes = req.body;
  console.log('v = 0.2');
  console.log('리퀘스트', mes.test);
  const parseWithLine = mes.test
    .replaceAll('\r', '')
    .replaceAll('님', '')
    .replaceAll(',', '')
    .split('\n');

  const today = dayjs();
  const confirmType = parseWithLine[1].split(' ')[2];
  const cardNumber = parseWithLine[2].split(' ')[0];
  const user = parseWithLine[2].split(' ')[1].split('님')[0];
  const date = parseWithLine[3].split(' ')[0];
  const time = parseWithLine[3].split(' ')[1];
  const fee = parseWithLine[4].split(' ')[0].replaceAll('원', '');
  const place = parseWithLine[5];
  console.log(
    dayjs(`2024/${date}`, 'YYYY/MM/DD HH:mm:ss').format('YYYY-MM-DD')
  );
  const param = {
    confirmType,
    cardNumber,
    user,
    date: dayjs(`2024/${date}`, 'YYYY/MM/DD').format('YYYY-MM-DD'),
    time: dayjs(`2024/${date} ${time}:00`, 'YYYY/MM/DD HH:mm:ss').format(
      'HH:mm:ss'
    ),
    fee: parseInt(fee),
    place,
  };
  try {
    console.log('파싱결과', param);

    const { data, error } = await supabase
      .from('card-usages')
      .insert([param])
      .select();
    if (error) {
      throw error;
    }
    if (data) {
      res.status(200).json(param);
    } else {
      throw new Error('No data');
    }
  } catch (err) {
    console.log(err);
    res.status(500).json(param);
  }
}
