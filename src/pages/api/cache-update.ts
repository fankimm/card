import 'dayjs/locale/ko';
import { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<any>
) {
  console.log('--- 캐시 업데이트 시작 ---');
  const response = await fetch(process.env.API_ENDPOINT || '');
  const data = (await response.json()) as { data: Data[] };
  (global as any).cachedData = data.data as Data[];
  console.log('--- 캐시 업데이트 끝 ---');
  res.status(200).json({ message: '캐시 업데이트 완료' });
}
