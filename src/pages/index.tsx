import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import Login from '@/components/login';

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
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();
  const handleSearch = () => {
    console.log(window.localStorage.getItem('loginInfo'));
    fetch(`/api/hello2?name=${window.localStorage.getItem('loginInfo')}`)
      .then((res) => res.json())
      .then((data) => {
        setTotal(data.data);
      });
  };
  useEffect(() => {
    if (window.localStorage.getItem('loginInfo')) {
      handleSearch();
      setHasSession(true);
    } else {
      setHasSession(false);
    }
  }, [router]);
  if (hasSession) {
    return (
      <div className="h-screen">
        <div className="p-8 flex justify-end">
          <div
            className="button opposite w-20 text-center"
            onClick={() => {
              window.localStorage.removeItem('loginInfo');
              router.push('/');
            }}
          >
            로그아웃
          </div>
        </div>
        <div className="flex flex-col justify-center items-center text-center">
          <div className="flex gap-3 text-7xl font-bold mb-4">
            <div
              className="hover:cursor-pointer text-red"
              onClick={handleSearch}
            >
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
          <div
            className="button opposite"
            onClick={() => router.push('/detail')}
          >
            상세 내역보기
          </div>
        </div>
      </div>
    );
  }
  return <Login />;
}
