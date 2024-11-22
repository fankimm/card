import { NextApiRequest, NextApiResponse } from 'next';

declare global {
  namespace NodeJS {
    interface Global {
      myData: {
        instanceId?: string;
      };
    }
  }
}

(global as any).myData = (global as any).myData || {};

// pages/api/test.js
export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const previousInstanceId = (global as any).myData.instanceId;
  if (!previousInstanceId) {
    const instanceId = Math.random().toString(36).substring(2, 15); // 랜덤한 고유 ID 생성
    (global as unknown as NodeJS.Global).myData.instanceId = instanceId;
  }
  const instanceId = (global as any).myData.instanceId;
  // 요청 처리 및 고유 ID 로깅
  console.log(`Request handled by instance: ${instanceId}`);

  res.status(200).json({ message: 'Request processed', instanceId });
}
