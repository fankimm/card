import { useCallback, useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import Login from '@/components/login';
interface HomeProps {
  date: string;
  setDate: Function;
}
export interface IOriginData {
  id: string;
  createdAt: string;
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
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
  const [originData, setOriginData] = useState<IOriginData[] | undefined>(
    undefined
  );
  const [totalLength, setTotalLength] = useState<number | undefined>(undefined);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showList, setShowList] = useState(false);
  const [월지원급액한도, set월지원급액한도] = useState<number>(0);
  const [출근일, set출근일] = useState<string[] | undefined>(undefined);
  const [남은일수, set남은일수] = useState<number | undefined>(undefined);
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
        console.log('get-total-fee data', data);
        setOriginData(data.originData);
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
          console.log('오리진 데이터', data);
          set출근일(data.data);
          let 월지급액한도계산;
          if (data.data.length >= 12) {
            console.log('출근일 12일 이상');
            월지급액한도계산 = 12000 * 12;
          } else {
            console.log('출근일 12일 미만');
            console.log('data', data);
            월지급액한도계산 = 12000 * data.data.length;
          }

          set월지원급액한도(월지급액한도계산);
        });

      handleSearch();
      setHasSession(true);
    } else {
      setHasSession(false);
    }
  }, [date, handleSearch]);
  useEffect(() => {
    if (!출근일) return;
    const 오늘먹음 = originData?.some(
      (i: any) => dayjs().format('YYYY-MM-DD') === i.date
    );
    set남은일수(
      출근일.filter((i: string) => dayjs().format('YYYY-MM-DD') <= i).length -
        (오늘먹음 ? 1 : 0) || 0
    );
  }, [originData, 출근일]);
  const isCurrentMonth = dayjs(date).isSame(dayjs(), 'month');
  const remainingAmount = 월지원급액한도 - (total || 0);
  const dailyBudget =
    !isCurrentMonth || !남은일수 || 남은일수 <= 0 || remainingAmount <= 0
      ? null
      : Math.floor(remainingAmount / 남은일수);
  useEffect(() => {
    const onLogin = () => {
      const loginInfo = window.localStorage.getItem('loginInfo');
      if (!loginInfo) return;
      fetch(
        `/api/get-office-days?name=${loginInfo}&date=${dayjs(date).format(
          'YYYY-MM'
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          set출근일(data.data);
          const 월지급액한도계산 =
            data.data.length >= 12 ? 12000 * 12 : 12000 * data.data.length;
          set월지원급액한도(월지급액한도계산);
        })
        .finally(() => {
          handleSearch();
          setHasSession(true);
        });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('login', onLogin);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('login', onLogin);
      }
    };
  }, [date, handleSearch]);
  if (hasSession) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 flex flex-col items-center text-center gap-6 pb-24">
          <div className="flex gap-3 font-bold mb-4 justify-center items-center">
            <button
              className="button flex justify-center items-center h-8"
              onClick={() => {
                setDate(dayjs(date).subtract(1, 'month').format('YYYY-MM-DD'));
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M15.78 3.97a.75.75 0 0 1 0 1.06L9.81 11l5.97 5.97a.75.75 0 1 1-1.06 1.06l-6.5-6.5a.75.75 0 0 1 0-1.06l6.5-6.5a.75.75 0 0 1 1.06 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div
              className="hover:cursor-pointer text-red text-5xl sm:text-6xl font-extrabold tracking-tight"
              onClick={() => {
                setDate(dayjs().format('YYYY-MM-DD'));
              }}
            >
              {monthName[parseInt(dayjs(date).format('M')) - 1]}
            </div>
            <button
              className={`${
                dayjs(date).isSame(dayjs(), 'month')
                  ? 'disabledButton'
                  : 'button'
              }  flex justify-center items-center h-8`}
              disabled={dayjs(date).isSame(dayjs(), 'month')}
              onClick={() => {
                setDate(dayjs(date).add(1, 'month').format('YYYY-MM-DD'));
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 3.97a.75.75 0 0 1 1.06 0l6.5 6.5a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06-1.06L14.19 11 8.22 5.03a.75.75 0 0 1 0-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="surface w-full max-w-md p-6 rounded-2xl">
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
            <div className="surface w-full max-w-md p-6 rounded-2xl flex flex-col gap-6">
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
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  건당 평균 금액
                </div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    ₩
                    {(totalLength === 0
                      ? 0
                      : (total || 0) / (totalLength || 0)
                    ).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
              <div className="divider" />
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
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">남은 일수</div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {남은일수}일
                  </div>
                )}
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  일평균 사용 가능 금액
                </div>
                {loading ? (
                  'LOADING...'
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {dailyBudget === null
                      ? '—'
                      : `₩${dailyBudget.toLocaleString('ko-KR')}`}
                  </div>
                )}
              </div>
            </div>
          )}
          {showList && (
            <div className="w-full max-w-2xl flex flex-col gap-2">
              {originData?.map((item) => (
                <div
                  className="surface p-4 rounded-xl flex justify-between items-center"
                  key={item.id}
                >
                  <div className="flex gap-3 items-start">
                    <div className="text-lg">{item.place}</div>
                    <div className="flex gap-2 subText items-center text-sm">
                      <div>{dayjs(item.date).format('YY.M.DD')}</div>
                      <div>
                        {dayjs(
                          item.date + item.time,
                          'YYYY-MM-DDHH:mm:ss'
                        ).format('HH:mm')}
                      </div>
                      <div
                        className={`rounded-full ${
                          item.confirmType === '승인' ? 'opposite' : 'redBox'
                        } text-[10px] px-2 py-[2px]`}
                      >
                        {item.confirmType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-lg font-semibold">
                    {`${parseInt(item.fee).toLocaleString('ko-kr')}원`}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="h-10" />
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))]">
          <div className="max-w-2xl mx-auto px-6 py-2 grid grid-cols-3 gap-6">
            <button
              className={`button w-full ${showDetail ? 'opposite' : ''}`}
              onClick={() => setShowDetail((v) => !v)}
            >
              <div className="flex flex-col items-center text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M12 3C7 3 2.73 7.11 2 12c.73 4.89 5 9 10 9s9.27-4.11 10-9c-.73-4.89-5-9-10-9Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
                </svg>
                <span>상세 정보</span>
              </div>
            </button>
            <button
              className={`button w-full ${showList ? 'opposite' : ''}`}
              onClick={() => setShowList((v) => !v)}
            >
              <div className="flex flex-col items-center text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
                </svg>
                <span>상세 내역</span>
              </div>
            </button>
            <button
              className="button w-full"
              onClick={() => {
                window.localStorage.removeItem('loginInfo');
                setHasSession(false);
              }}
            >
              <div className="flex flex-col items-center text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M13 3h-2v10h2V3Zm-1 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                </svg>
                <span>로그아웃</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <Login />;
}
