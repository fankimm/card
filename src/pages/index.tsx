import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

export default function Home() {
  const monthName = [
    'JANUARY',
    'FEBURARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVERMBER',
    'DECEMBER',
  ];

  const [total, setTotal] = useState<number | undefined>(undefined);
  useEffect(() => {
    fetch('/api/hello2')
      .then((res) => res.json())
      .then((data) => {
        setTotal(data.data);
      });
  }, []);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="flex gap-3 text-7xl font-bold mb-4">
        <div>{monthName[parseInt(dayjs().format('M')) - 1]}</div>
      </div>
      <div className="subText text-2xl font-light">총 사용금액</div>
      <div className="text-4xl font-semibold mb-4">{`₩${total?.toLocaleString(
        'ko-KR'
      )}`}</div>
      <div className="button opposite">상세 내역보기</div>
    </div>
  );
}
