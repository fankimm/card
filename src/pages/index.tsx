import { useCallback, useContext, useEffect, useState } from 'react';
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
  const [totalLength, setTotalLength] = useState<number | undefined>(undefined);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [월지원급액한도, set월지원급액한도] = useState<number>(0);
  const [출근일, set출근일] = useState<string[] | undefined>(undefined);
  const router = useRouter();

  const handleSearch = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/get-total-fee?name=${window.localStorage.getItem(
        'loginInfo'
      )}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log('data', data);
        setTotal(data.data);
        setTotalLength(data.length);
      })
      .finally(() => {
        setLoading(false);
      });
    fetch('/api/cache-update');
  }, [date]);
  useEffect(() => {
    const loginInfo = window.localStorage.getItem('loginInfo');
    if (loginInfo) {
      fetch(
        `/api/get-office-days?name=${loginInfo}&date=${dayjs(date).format(
          'YYYY-MM'
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          console.log('data', data);
          set출근일(data.data);
          set월지원급액한도(data.data.length * 12000);
        });

      handleSearch();
      setHasSession(true);
    } else {
      setHasSession(false);
    }
  }, [router, date, handleSearch]);
  if (hasSession) {
    return (
      <div className="h-screen">
        <div className="p-8 flex justify-between">
          <div
            className="button opposite"
            onClick={() => router.push('/detail')}
          >
            상세 내역보기
          </div>
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
          {showDetail && (
            <>
              {' '}
              <div>
                <div className="subText text-2xl font-light">총 사용건수</div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {totalLength}건
                  </div>
                )}
              </div>
              <div>
                <div className="subText text-2xl font-light">
                  건당 평균 금액
                </div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    ₩
                    {((total || 0) / (totalLength || 0)).toLocaleString(
                      'ko-KR'
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="subText text-2xl font-light">남은 금액</div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    ₩{(월지원급액한도 - (total || 0)).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
              <div>
                <div className="subText text-2xl font-light">남은 일수</div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {
                      출근일?.filter((i) => dayjs().format('YYYY-MM-DD') < i)
                        .length
                    }
                    일
                  </div>
                )}
              </div>
              <div>
                <div className="subText text-2xl font-light">
                  일평균 사용 가능 금액
                </div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    ₩
                    {(
                      (월지원급액한도 - (total || 0)) /
                      ((출근일?.length || 0) - (totalLength || 0))
                    ).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
            </>
          )}
          <div
            className="button opposite"
            onClick={() => {
              setShowDetail(!showDetail);
            }}
          >
            남은사용금액
          </div>
        </div>
      </div>
    );
  }
  return <Login />;
}
