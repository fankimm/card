// 데이터 추가 api
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { getData } from './hello2';
import util from 'util';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );
  await getData();
  //const mes = '[Web발신]\n[MY COMPANY] 승인\r\n8713 김지환님\r\n07/23 12:38\r\n16,750원 일시불\r\n오늘은닭'
  const isDev = process.env.NODE_ENV === 'development';
  const mes = isDev ? JSON.parse(req.body) : req.body;
  console.log('v = 0.2');
  console.log('리퀘스트', req.body);
  console.log('리퀘스트', mes.test);
  const parseWithLine = mes.test
    .replaceAll('\r', '')
    .replaceAll('님', '')
    .replaceAll(',', '')
    .split('\n');

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

  if (time > '15:00:00') {
    res.status(200).json({ message: '점심시간이 아닙니다.' });
    return;
  }

  const param = {
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
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
    const response = await fetch(process.env.API_ENDPOINT || '', {
      method: 'POST',
      body: JSON.stringify(param),
    });
    const data = await response.json();
    const update = {
      confirmType,
      cardNumber,
      user,
      date: dayjs(`2024/${date}`, 'YYYY/MM/DD').format('YYYY-MM-DD'),
      time: dayjs(`2024/${date} ${time}:00`, 'YYYY/MM/DD HH:mm:ss').format(
        'HH:mm:ss'
      ),
      fee,
      place,
    };
    const cachedData = global.cachedData || [];
    const cache = [...cachedData, update];

    if (data?.message === '성공') {
      global.cachedData = cache;
      console.log('업데이트 후 셋캐시');
    }
    res.status(200).json(param);
  } catch (err) {
    console.log(err);
    res.status(500).json(param);
  }
  // supabase 로직
  // try {
  //   console.log('파싱결과', param);

  //   const { data, error } = await supabase
  //     .from('card-usages')
  //     .insert([param])
  //     .select();
  //   if (error) {
  //     throw error;
  //   }
  //   if (data) {
  //     res.status(200).json(param);
  //   } else {
  //     throw new Error('No data');
  //   }
  // } catch (err) {
  //   console.log(err);
  //   res.status(500).json(param);
  // }
}
