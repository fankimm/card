import { useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import Login from '@/components/login';
interface HomeProps {
  date: string;
  setDate: Function;
}
export default function Home({ date, setDate }: HomeProps) {
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = () => {
    console.log('date', date);
    setLoading(true);
    fetch(
      `/api/hello2?name=${window.localStorage.getItem(
        'loginInfo'
      )}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        setTotal(data.data);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  useEffect(() => {
    if (window.localStorage.getItem('loginInfo')) {
      handleSearch();
      setHasSession(true);
    } else {
      setHasSession(false);
    }
  }, [router, date]);
  if (hasSession) {
    return (
      <div className="h-screen">
        <div className="p-8 flex justify-end gap-4">
          <div
            className="button opposite w-20 text-center"
            onClick={() => {
              setDate(dayjs().format('YYYY-MM-DD'));
            }}
          >
            오늘
          </div>
          <div
            className="button opposite w-20 text-center"
            onClick={() => {
              setDate(dayjs(date).subtract(1, 'month').format('YYYY-MM-DD'));
            }}
          >
            이전달
          </div>
          <button
            className={`${
              dayjs(date).isSame(dayjs(), 'month')
                ? 'disabledButton'
                : 'button opposite'
            }  w-20 text-center`}
            disabled={dayjs(date).isSame(dayjs(), 'month')}
            onClick={() => {
              setDate(dayjs(date).add(1, 'month').format('YYYY-MM-DD'));
            }}
          >
            다음달
          </button>
          <div
            className="button opposite w-24 text-center"
            onClick={() => {
              window.localStorage.removeItem('loginInfo');
              router.push('/');
            }}
          >
            로그아웃
          </div>
        </div>
        <div className="flex flex-col justify-center items-center text-center">
          <div className="flex gap-3 text-[13vw] font-bold mb-4">
            <div
              className="hover:cursor-pointer text-red"
              onClick={handleSearch}
            >
              {monthName[parseInt(dayjs(date).format('M')) - 1]}
            </div>
          </div>
          <div>
            <div className="subText text-2xl font-light">총 사용금액</div>
            {loading ? (
              'LOADING...'
            ) : (
              <div className="text-4xl font-semibold mb-4">{`₩${total?.toLocaleString(
                'ko-KR'
              )}`}</div>
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
