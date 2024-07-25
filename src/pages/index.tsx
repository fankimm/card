import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

export default function Home() {
  const [total, setTotal] = useState<number | undefined>(undefined);
  useEffect(() => {
    fetch('/api/hello2')
      .then((res) => res.json())
      .then((data) => {
        setTotal(data.data);
      });
  }, []);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-2xl">{`${dayjs().format('M')}월`}</div>
      <div>{`총 사용금액 : ${total?.toLocaleString('ko-KR')}`}</div>
    </div>
  );
}
