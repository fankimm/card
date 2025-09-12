import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  LogOut,
  Info,
  List,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Moon,
} from 'lucide-react';
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
  const [selectedItem, setSelectedItem] = useState<IOriginData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsUserOnly, setStatsUserOnly] = useState(true);
  const [savedScrollTop, setSavedScrollTop] = useState(0);
  const [월지원급액한도, set월지원급액한도] = useState<number>(0);
  const [출근일, set출근일] = useState<string[] | undefined>(undefined);
  const [남은일수, set남은일수] = useState<number | undefined>(undefined);
  const [allData, setAllData] = useState<IOriginData[] | undefined>(undefined);
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
        setAllData(data.allData);
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
  const placeStats = useMemo(() => {
    if (!allData) return [] as { place: string; count: number }[];
    const login =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('loginInfo')
        : '';
    const filtered = allData
      ?.filter((i) =>
        statsUserOnly && login ? i.user.trim() === login.trim() : true
      )
      .filter((i) => i.confirmType !== '취소')
      .filter((i) => i.time > '10:00:00' && i.time < '16:00:00');
    const map = new Map<string, number>();
    filtered.forEach((i) => {
      const key = i.place || '기타';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count);
  }, [allData, statsUserOnly]);
  const maxPlaceCount = useMemo(() => {
    return placeStats.reduce((max, s) => (s.count > max ? s.count : max), 1);
  }, [placeStats]);
  const top5Stats = useMemo(() => {
    return placeStats.slice(0, 5);
  }, [placeStats]);
  const bottom5Stats = useMemo(() => {
    const last5 = placeStats.slice(-5);
    return last5.reverse();
  }, [placeStats]);
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
        <div className="sticky top-0 z-20 glass glassSolid px-2">
          <div className="max-w-2xl mx-auto py-2">
            <div className="px-3 flex items-center justify-between gap-2">
              <button
                className="tabItem"
                onClick={() => {
                  setDate(
                    dayjs(date).subtract(1, 'month').format('YYYY-MM-DD')
                  );
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div
                className="hover:cursor-pointer flex-1 text-center text-red text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight"
                onClick={() => {
                  setDate(dayjs().format('YYYY-MM-DD'));
                }}
              >
                {monthName[parseInt(dayjs(date).format('M')) - 1]}
              </div>
              <button
                className={`tabItem ${
                  dayjs(date).isSame(dayjs(), 'month')
                    ? 'opacity-50 pointer-events-none'
                    : ''
                }`}
                disabled={dayjs(date).isSame(dayjs(), 'month')}
                onClick={() => {
                  setDate(dayjs(date).add(1, 'month').format('YYYY-MM-DD'));
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 mt-3 sm:mt-4 flex flex-col items-center text-center gap-6 pb-24">
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
            <div className="surface w-full max-w-md p-6 rounded-2xl flex flex-col gap-6 anim-slide-up">
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
            <div className="w-full max-w-2xl flex flex-col gap-2 anim-slide-up">
              {originData?.map((item) => (
                <div
                  className="surface p-4 rounded-xl flex justify-between items-center hover:opacity-95 cursor-pointer"
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="flex flex-col gap-1 items-start">
                    <div className="text-lg max-w-[60vw] sm:max-w-[480px] truncate">
                      {item.place}
                    </div>
                    <div className="flex gap-2 subText items-center text-sm flex-nowrap">
                      <div>{dayjs(item.date).format('YY.M.DD')}</div>
                      <div>
                        {dayjs(
                          item.date + item.time,
                          'YYYY-MM-DDHH:mm:ss'
                        ).format('HH:mm')}
                      </div>
                      <div
                        className={`rounded-full whitespace-nowrap ${
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
          {showStats && (
            <div className="w-full max-w-2xl flex flex-col gap-4 anim-slide-up">
              <div className="surface rounded-2xl p-3 flex justify-center">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    className={`tabItem ${
                      statsUserOnly ? 'tabItemActive' : ''
                    }`}
                    onClick={() => setStatsUserOnly(true)}
                  >
                    내 통계
                  </button>
                  <div className="divider w-px h-5" />
                  <button
                    className={`tabItem ${
                      !statsUserOnly ? 'tabItemActive' : ''
                    }`}
                    onClick={() => setStatsUserOnly(false)}
                  >
                    전체 통계
                  </button>
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">
                  최다 방문 Top 5
                </div>
                <div className="flex flex-col gap-2">
                  {top5Stats.map((s) => (
                    <div
                      key={`top-${s.place}`}
                      className="flex items-center gap-3"
                    >
                      <div className="text-sm truncate w-32 sm:w-48">
                        {s.place}
                      </div>
                      <div className="flex-1 h-3 surface rounded-full overflow-hidden">
                        <div
                          className="h-full opposite rounded-full"
                          style={{
                            width: `${(s.count / maxPlaceCount) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-10 text-right text-sm">{s.count}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">
                  최소 방문 Top 5
                </div>
                <div className="flex flex-col gap-2">
                  {bottom5Stats.map((s) => (
                    <div
                      key={`bottom-${s.place}`}
                      className="flex items-center gap-3"
                    >
                      <div className="text-sm truncate w-32 sm:w-48">
                        {s.place}
                      </div>
                      <div className="flex-1 h-3 surface rounded-full overflow-hidden">
                        <div
                          className="h-full opposite rounded-full"
                          style={{
                            width: `${(s.count / maxPlaceCount) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-10 text-right text-sm">{s.count}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">전체 목록</div>
                <div className="flex flex-col gap-2">
                  {placeStats.map((s) => (
                    <div
                      key={`all-${s.place}`}
                      className="flex items-center gap-3"
                    >
                      <div className="text-sm truncate w-32 sm:w-48">
                        {s.place}
                      </div>
                      <div className="flex-1 h-3 surface rounded-full overflow-hidden">
                        <div
                          className="h-full opposite rounded-full"
                          style={{
                            width: `${(s.count / maxPlaceCount) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-10 text-right text-sm">{s.count}</div>
                    </div>
                  ))}
                </div>
              </div>
              {placeStats.length === 0 && (
                <div className="subText">데이터가 없습니다.</div>
              )}
            </div>
          )}
          {!!selectedItem && (
            <div
              className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 transition-opacity duration-200 ${
                isModalOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => {
                setIsModalOpen(false);
                setTimeout(() => setSelectedItem(null), 200);
              }}
            >
              <div
                className={`surface w-full sm:w-auto max-w-md sm:rounded-2xl rounded-t-2xl p-5 m-0 sm:m-4 transition-all duration-200 ${
                  isModalOpen
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-3 opacity-0'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xl font-bold mb-2 truncate">
                  {selectedItem.place}
                </div>
                <div className="subText text-sm mb-3 flex gap-3 items-center flex-wrap">
                  <span>{dayjs(selectedItem.date).format('YYYY.MM.DD')}</span>
                  <span>
                    {dayjs(
                      selectedItem.date + selectedItem.time,
                      'YYYY-MM-DDHH:mm:ss'
                    ).format('HH:mm')}
                  </span>
                  <span
                    className={`rounded-full whitespace-nowrap ${
                      selectedItem.confirmType === '승인'
                        ? 'opposite'
                        : 'redBox'
                    } text-[10px] px-2 py-[2px]`}
                  >
                    {selectedItem.confirmType}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <div className="subText">결제 금액</div>
                  <div className="text-lg font-semibold">
                    {`${parseInt(selectedItem.fee).toLocaleString('ko-kr')}원`}
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <div className="subText">카드번호</div>
                  <div className="text-sm">{selectedItem.cardNumber}</div>
                </div>
                <div className="flex justify-between items-center mb-0">
                  <div className="subText">사용자</div>
                  <div className="text-sm">{selectedItem.user}</div>
                </div>
                {/* 배경 클릭으로 닫힘 */}
              </div>
            </div>
          )}
          <div className="h-10" />
        </div>
        <div className="fixed left-0 right-0 bottomNav px-2">
          <div className="max-w-2xl mx-auto px-4 py-2 grid grid-cols-5 gap-3 rounded-full surface">
            <button
              className={`tabItem w-full ${showDetail ? 'tabItemActive' : ''}`}
              onClick={() => {
                setSavedScrollTop(
                  typeof window !== 'undefined' ? window.scrollY : 0
                );
                setShowList(false);
                setShowStats(false);
                setShowDetail((v) => !v);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <Info className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${showList ? 'tabItemActive' : ''}`}
              onClick={() => {
                setSavedScrollTop(
                  typeof window !== 'undefined' ? window.scrollY : 0
                );
                setShowDetail(false);
                setShowStats(false);
                setShowList((v) => !v);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <List className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${showStats ? 'tabItemActive' : ''}`}
              onClick={() => {
                setSavedScrollTop(
                  typeof window !== 'undefined' ? window.scrollY : 0
                );
                setShowDetail(false);
                setShowList(false);
                setShowStats((v) => !v);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <BarChart2 className="w-5 h-5" />
              </div>
            </button>
            <button
              className="tabItem w-full"
              onClick={() => {
                window.localStorage.removeItem('loginInfo');
                setHasSession(false);
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <LogOut className="w-5 h-5" />
              </div>
            </button>
            <button
              className="tabItem w-full"
              onClick={() => {
                const current =
                  document.documentElement.getAttribute('data-theme');
                const next = current === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute(
                  'data-theme',
                  next || 'dark'
                );
                try {
                  localStorage.setItem('theme', next || 'dark');
                } catch {}
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <Moon className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <Login />;
}
