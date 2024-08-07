import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const handleSearch = () => {
    fetch('/api/hello2')
      .then((res) => res.json())
      .then((data) => {
        setTotal(data.data);
      });
  };
  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="flex flex-col justify-center items-center h-screen text-center">
      <div className="flex gap-3 text-7xl font-bold mb-4">
        <div className="hover:cursor-pointer text-red" onClick={handleSearch}>
          {monthName[parseInt(dayjs().format('M')) - 1]}
        </div>
      </div>

      <div>
        <div className="subText text-2xl font-light">총 사용금액</div>
        {total !== undefined ? (
          <div className="text-4xl font-semibold mb-4">{`₩${total?.toLocaleString(
            'ko-KR'
          )}`}</div>
        ) : (
          'LOADING...'
        )}
      </div>
      <div className="button opposite" onClick={() => router.push('/detail')}>
        상세 내역보기
      </div>
    </div>
  );
}
