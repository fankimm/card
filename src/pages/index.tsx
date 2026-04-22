import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LogOut,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Home as HomeIcon,
  Utensils,
  Menu,
  Shuffle,
  EyeOff,
  Eye,
} from 'lucide-react';
import relativeTime from 'dayjs/plugin/relativeTime';
import AdBanner from '@/components/AdBanner';
import Twemoji from '@/components/Twemoji';
import SeasonalEffect from '@/components/SeasonalEffect';
import HeatHaze from '@/components/HeatHaze';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
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

function SwipeableListItem({
  children,
  itemId,
  isExcluded,
  disabled,
  onToggleExclude,
  openId,
  setOpenId,
  onTap,
}: {
  children: React.ReactNode;
  itemId: string;
  isExcluded: boolean;
  disabled?: boolean;
  onToggleExclude: () => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onTap: () => void;
}) {
  const W = 72;
  const SPRING = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
  const isOpen = openId === itemId;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const t = useRef({ sx: 0, sy: 0, swiping: false, moved: false });
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen && elRef.current) {
      elRef.current.style.transition = SPRING;
      elRef.current.style.transform = 'translateX(0)';
    }
  }, [isOpen]);

  // Native touchmove listener for preventDefault (blocks vertical scroll during swipe)
  useEffect(() => {
    const el = elRef.current;
    if (!el || disabled) return;
    const onMove = (e: TouchEvent) => {
      if (t.current.swiping) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [disabled]);

  if (disabled) return <div onClick={onTap}>{children}</div>;

  const doClose = () => {
    if (elRef.current) {
      elRef.current.style.transition = SPRING;
      elRef.current.style.transform = 'translateX(0)';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: W }}
      >
        <button
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-semibold shadow-md ${
            isExcluded ? 'bg-blue-500' : 'bg-amber-500'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExclude();
            setOpenId(null);
            doClose();
          }}
        >
          {isExcluded ? (
            <Eye className="w-5 h-5" />
          ) : (
            <EyeOff className="w-5 h-5" />
          )}
          <span>{isExcluded ? '포함' : '제외'}</span>
        </button>
      </div>
      <div
        ref={elRef}
        className="relative rounded-xl"
        style={{ background: 'rgb(var(--bg-elev))' }}
        onTouchStart={(e) => {
          t.current = {
            sx: e.touches[0].clientX,
            sy: e.touches[0].clientY,
            swiping: false,
            moved: false,
          };
          if (!isOpenRef.current && openId) setOpenId(null);
        }}
        onTouchMove={(e) => {
          const s = t.current;
          const dx = e.touches[0].clientX - s.sx;
          const dy = e.touches[0].clientY - s.sy;
          if (!s.swiping) {
            if (Math.abs(dy) > Math.abs(dx)) return;
            if (Math.abs(dx) > 8) s.swiping = true;
            else return;
          }
          s.moved = true;
          const base = isOpenRef.current ? -W : 0;
          const raw = base + dx;
          let offset: number;
          if (raw < -W) {
            offset = -(W + (-raw - W) * 0.3);
          } else {
            offset = Math.min(0, raw);
          }
          if (elRef.current) {
            elRef.current.style.transition = 'none';
            elRef.current.style.transform = `translateX(${offset}px)`;
          }
        }}
        onTouchEnd={() => {
          if (!t.current.moved) return;
          const el = elRef.current;
          if (!el) return;
          const x = new DOMMatrix(getComputedStyle(el).transform).m41;
          const cw = el.parentElement?.clientWidth || 300;
          el.style.transition = SPRING;
          if (-x > cw * 0.55) {
            el.style.transform = `translateX(-${cw}px)`;
            setTimeout(() => {
              onToggleExclude();
              setOpenId(null);
              doClose();
            }, 280);
          } else if (x < -30) {
            el.style.transform = `translateX(-${W}px)`;
            setOpenId(itemId);
          } else {
            el.style.transform = 'translateX(0)';
            if (isOpenRef.current) setOpenId(null);
          }
        }}
        onClick={() => {
          if (t.current.moved) {
            t.current.moved = false;
            return;
          }
          if (isOpenRef.current) {
            setOpenId(null);
            return;
          }
          onTap();
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Recommend({
  allData,
  date,
}: {
  allData?: IOriginData[];
  date: string;
}) {
  // Hooks must be called unconditionally
  const [index, setIndex] = useState(0);
  const viewedWithoutAdRef = useRef(0);

  if (!allData || allData.length === 0) {
    return (
      <div className="subText">데이터가 없어 추천을 생성할 수 없어요.</div>
    );
  }
  const login =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('loginInfo')?.trim()
      : '';
  const month = dayjs();
  const all = allData
    .filter((i) => (login ? i.user?.trim() === login : true))
    .filter((i) => i.time > '10:00:00' && i.time < '16:00:00');
  if (all.length === 0) {
    return <div className="subText">사용자 데이터가 부족해요.</div>;
  }
  const thisMonth = all.filter((i) => dayjs(i.date).isSame(month, 'month'));

  type PlaceStat = {
    place: string;
    countOverall: number;
    totalOverall: number;
    lastOverall: string;
    countThisMonth: number;
    avgOverall: number;
  };
  const statsMap = new Map<string, PlaceStat>();
  all.forEach((i) => {
    const key = i.place || '기타';
    const prev = statsMap.get(key) || {
      place: key,
      countOverall: 0,
      totalOverall: 0,
      lastOverall: '1970-01-01',
      countThisMonth: 0,
      avgOverall: 0,
    };
    const lastOverall = dayjs(i.date).isAfter(prev.lastOverall)
      ? i.date
      : prev.lastOverall;
    const next: PlaceStat = {
      ...prev,
      countOverall: prev.countOverall + (i.confirmType !== '취소' ? 1 : 0),
      totalOverall:
        prev.totalOverall +
        (i.confirmType !== '취소' ? parseInt(i.fee as any, 10) || 0 : 0),
      lastOverall,
      countThisMonth:
        prev.countThisMonth +
        (dayjs(i.date).isSame(month, 'month') && i.confirmType !== '취소'
          ? 1
          : 0),
    };
    statsMap.set(key, next);
  });
  // 평균 갱신
  statsMap.forEach((v, k) => {
    const avg =
      v.countOverall > 0 ? Math.round(v.totalOverall / v.countOverall) : 0;
    statsMap.set(k, { ...v, avgOverall: avg });
  });

  const stats = Array.from(statsMap.values()).filter((s) => s.countOverall > 0);
  if (stats.length === 0) {
    return <div className="subText">유효한 방문 데이터가 없어요.</div>;
  }

  const currency = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const daysSince = (iso: string) => dayjs().diff(dayjs(iso), 'day');

  const byCountThisMonthDesc = [...stats].sort(
    (a, b) => b.countThisMonth - a.countThisMonth
  );
  const byCountOverallDesc = [...stats].sort(
    (a, b) => b.countOverall - a.countOverall
  );
  const byAvgAsc = [...stats].sort((a, b) => a.avgOverall - b.avgOverall);
  const byAvgDesc = [...stats].sort((a, b) => b.avgOverall - a.avgOverall);
  const byStalenessDesc = [...stats].sort(
    (a, b) => daysSince(b.lastOverall) - daysSince(a.lastOverall)
  );

  // 1) 밸런스 추천: 적당한 빈도(2~4), 최근 방문 아님, 평균 12,000원 근접
  const balanced = (() => {
    const monthCounts = new Map<string, number>();
    thisMonth.forEach((i) => {
      if (i.confirmType === '취소') return;
      monthCounts.set(i.place, (monthCounts.get(i.place) || 0) + 1);
    });
    const candidates = stats.map((s) => {
      const cnt = monthCounts.get(s.place) || 0;
      const freqScore = Math.max(0, 5 - Math.abs(cnt - 3));
      const recencyPenalty = Math.min(3, daysSince(s.lastOverall) < 3 ? 3 : 0);
      const spendModerate = Math.max(
        0,
        5 - Math.abs(s.avgOverall - 12000) / 3000
      );
      const score = freqScore + spendModerate - recencyPenalty;
      return { s, score, cnt };
    });
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0]?.s;
    if (!top) return null;
    return {
      label: '밸런스 추천',
      place: top.place,
      reason: `최근 ${daysSince(top.lastOverall)}일 전 방문, 평균 ${currency(
        top.avgOverall
      )}, 이번 달 ${monthCounts.get(top.place) || 0}회 방문`,
    };
  })();

  // 2) 최애 픽: 이번 달 최다 방문
  const favorite = (() => {
    const top = byCountThisMonthDesc[0] || byCountOverallDesc[0];
    if (!top) return null;
    const cnt = top.countThisMonth || 0;
    return {
      label: '최애 픽',
      place: top.place,
      reason: `${dayjs().format('M')}월에 ${cnt}회 방문, 익숙한 그 맛!`,
    };
  })();

  // 3) 숨은 맛집: 이번 달 거의 안 간 곳(0~1회) + 오래 안 간 곳
  const hiddenGem = (() => {
    const candidates = stats
      .filter((s) => s.countThisMonth <= 1)
      .sort((a, b) => daysSince(b.lastOverall) - daysSince(a.lastOverall));
    const top = candidates[0];
    if (!top) return null;
    const when = daysSince(top.lastOverall);
    return {
      label: '숨은 맛집',
      place: top.place,
      reason: `이번 달엔 거의 안 갔어요. 마지막 방문 ${when}일 전`,
    };
  })();

  // 4) 가성비 픽: 평균 결제액 최저 (방문 2회 이상 우선)
  const budgetSaver = (() => {
    const many = stats.filter((s) => s.countOverall >= 2);
    const arr = (many.length > 0 ? many : stats).sort(
      (a, b) => a.avgOverall - b.avgOverall
    );
    const top = arr[0];
    if (!top) return null;
    return {
      label: '가성비 픽',
      place: top.place,
      reason: `평균 ${currency(top.avgOverall)}로 부담 없이 즐겨요`,
    };
  })();

  // 5) 보상 픽: 평균 결제액 최고 (방문 2회 이상 우선)
  const treatYourself = (() => {
    const many = stats.filter((s) => s.countOverall >= 2);
    const arr = (many.length > 0 ? many : stats).sort(
      (a, b) => b.avgOverall - a.avgOverall
    );
    const top = arr[0];
    if (!top) return null;
    return {
      label: '보상 픽',
      place: top.place,
      reason: `평균 ${currency(top.avgOverall)}, 오늘은 기분 좋게!`,
    };
  })();

  // 6) 오랜만 픽: 마지막 방문까지 가장 오래된 곳
  const longTimeNoSee = (() => {
    const top = byStalenessDesc[0];
    if (!top) return null;
    const when = daysSince(top.lastOverall);
    return {
      label: '오랜만 픽',
      place: top.place,
      reason: `${when}일 만에 다시 가볼까요?`,
    };
  })();

  // 7) 랜덤 즐겨찾기: 전체 최다 방문 상위 5 중 랜덤
  const randomTop = (() => {
    const top5 = byCountOverallDesc.slice(0, 5);
    if (top5.length === 0) return null;
    const pick = top5[Math.floor(Math.random() * top5.length)];
    return {
      label: '랜덤 즐겨찾기',
      place: pick.place,
      reason: `즐겨찾기 상위에서 랜덤 추천!`,
    };
  })();

  const recs = [
    balanced,
    favorite,
    hiddenGem,
    budgetSaver,
    treatYourself,
    longTimeNoSee,
    randomTop,
  ].filter(Boolean) as { label: string; place: string; reason: string }[];

  // 중복 장소 제거하여 다양성 확보
  const unique: typeof recs = [];
  const seen = new Set<string>();
  for (const r of recs) {
    if (seen.has(r.place)) continue;
    seen.add(r.place);
    unique.push(r);
  }

  const current = unique[index] || unique[0];

  if (!current) {
    return <div className="subText">추천 결과가 없어요.</div>;
  }

  const handleNext = () => {
    // 첫 1회는 무료, 이후는 광고 시청 유도
    if (viewedWithoutAdRef.current === 0) {
      viewedWithoutAdRef.current += 1;
      setIndex((p) => Math.min(p + 1, unique.length - 1));
      return;
    }
    // 광고 트리거: 실제 보상형 광고가 없으니 배너 노출 후 약간의 대기 시점으로 대체
    const adEl = document.getElementById('ad-banner-recommend');
    if (adEl) {
      adEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // 간단한 안내 후 다음 추천 공개
    alert('광고를 잠시 확인해 주세요. (데모)');
    setTimeout(() => {
      setIndex((p) => Math.min(p + 1, unique.length - 1));
    }, 800);
  };

  return (
    <div className="flex flex-col">
      <div className="text-xl font-bold">오늘의 점심 추천</div>
      <div className="mt-2 flex flex-col gap-3">
        <div className="rounded-xl p-3 surface">
          <div className="text-xs subText mb-1">{current.label}</div>
          <div className="text-lg font-semibold">{current.place}</div>
          <div className="text-xs subText mt-1">{current.reason}</div>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="glassPill w-full text-center px-3 py-2 flex items-center justify-center gap-1 hover:opacity-90"
            onClick={handleNext}
          >
            <Shuffle className="w-4 h-4" />
            <span>다른 추천 보기</span>
          </button>
          <div className="subText text-[10px] mt-1 text-center w-full">
            첫 1회 무료 · 이후 광고 시청
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home({ date, setDate }: HomeProps) {
  dayjs.extend(relativeTime);
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
  const [showHome, setShowHome] = useState(true);
  const [showRecommend, setShowRecommend] = useState(false);
  const [statsUserOnly, setStatsUserOnly] = useState(false);
  const [showAllList, setShowAllList] = useState(false);
  const [월지원급액한도, set월지원급액한도] = useState<number>(0);
  const [출근일, set출근일] = useState<string[] | undefined>(undefined);
  const [남은일수, set남은일수] = useState<number | undefined>(undefined);
  const [미지원출근일, set미지원출근일] = useState<string[]>([]);
  const [allData, setAllData] = useState<IOriginData[] | undefined>(undefined);
  const [homeHeaderIntro, setHomeHeaderIntro] = useState(false);
  const [aiInsightText, setAiInsightText] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [aiInsightKey, setAiInsightKey] = useState<string | null>(null);
  const router = useRouter();

  // 집계 제외 항목 관리 (Google Sheets 연동)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const fetchExcludedItems = useCallback(() => {
    const login = typeof window !== 'undefined' ? window.localStorage.getItem('loginInfo') : '';
    if (!login) return;
    fetch(`/api/excluded-items?name=${encodeURIComponent(login)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.data && Array.isArray(data.data)) {
          setExcludedIds(new Set(data.data.map(String)));
        }
      })
      .catch(() => {});
  }, []);
  const toggleExclude = useCallback((id: string) => {
    const login = typeof window !== 'undefined' ? window.localStorage.getItem('loginInfo') : '';
    if (!login) return;
    // 낙관적 업데이트
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    fetch('/api/excluded-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: login, itemId: id }),
    }).catch(() => {
      // 실패 시 롤백
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    });
  }, []);

  // 제외 항목 반영된 집계
  const adjustedData = useMemo(() => {
    if (!originData) return { total: 0, totalLength: 0, usedDays: 0 };
    const included = originData.filter(i => !excludedIds.has(i.id) && i.confirmType !== '취소');
    const uniqueDates = new Set(included.map(i => i.date));
    return {
      total: included.reduce((acc, i) => acc + (parseInt(i.fee as any, 10) || 0), 0),
      totalLength: included.length,
      usedDays: uniqueDates.size,
    };
  }, [originData, excludedIds]);

  // Stable monthly tagline selection (no flicker on re-render)
  const monthKey = dayjs(date).format('YYYY-MM');
  const monthNumber = parseInt(dayjs(date).format('M'), 10);
  // 계절 이펙트는 네비게이터의 월(date) 기준으로 표시되도록 변경
  const currentSeason: 'spring' | 'summer' | 'autumn' | 'winter' =
    monthNumber >= 3 && monthNumber <= 5
      ? 'spring'
      : monthNumber >= 6 && monthNumber <= 8
      ? 'summer'
      : monthNumber >= 9 && monthNumber <= 11
      ? 'autumn'
      : 'winter';
  const [hideSeasonal, setHideSeasonal] = useState(false);
  const monthTagline = useMemo(() => {
    const lines: Record<number, string[]> = {
      1: [
        '새해엔 점심부터 챙기자',
        '1월, 다이어트는 내일부터',
        '국물엔 만두, 점심엔 행복',
      ],
      2: [
        '2월, 짧아서 더 맛있게',
        '바람은 차갑고 국물은 뜨겁게',
        '점심 사랑 고백의 달',
      ],
      3: [
        '새학기엔 새 점심 루틴',
        '봄바람에 입맛도 깨어난다',
        '꽃샘추위엔 따끈한 점심',
      ],
      4: [
        '4월, 벚꽃보다 맛집 지도',
        '점심 산책, 한 숟갈 행복',
        '봄처럼 가벼운 메뉴',
      ],
      5: [
        '5월, 점심으로 힐링 완료',
        '초여름 감성 콜드누들',
        '바삭함이 행복이다',
      ],
      6: [
        '장마엔 튀김이 국룰',
        '6월, 얼음 동동 점심 국물',
        '반찬은 비와 리듬 맞추기',
      ],
      7: [
        '7월, 땀 흘리고 더 맛있게',
        '차가운 면, 뜨거운 열정',
        '점심엔 수박 말고 냉면',
      ],
      8: [
        '8월, 맵단짠으로 버티기',
        '태양 아래 얼큰-시원',
        '밥알도 바캉스가 필요해',
      ],
      9: [
        '하늘은 높고 말이 살찐다. 근데 내가 더 찔 듯',
        '9월, 바삭 달달 풍성한 한 끼',
        '구수함에 가을이 떨어졌다',
      ],
      10: [
        '10월, 점심은 소확행의 정점',
        '고소함이 춤추는 계절',
        '따끈한 국물에 마음 녹이기',
      ],
      11: [
        '11월, 김이 모락모락',
        '깊어진 점심, 진해진 행복',
        '한 입에 겨울 맞이',
      ],
      12: [
        '12월은 점심 회고의 달',
        '뜨끈-달달-든든, 연말 삼박자',
        '한 해의 마무리는 맛있게',
      ],
    };
    const arr = lines[monthNumber] || ['오늘도 맛있게'];
    // Deterministic pick by monthKey hash
    const hash = Array.from(monthKey).reduce(
      (h, ch) => (h << 5) - h + ch.charCodeAt(0),
      0
    );
    const idx = Math.abs(hash) % arr.length;
    return arr[idx];
  }, [monthKey, monthNumber]);

  // Header animation template switching by hour
  const headerTemplateIndex = useMemo(() => dayjs().hour() % 3, []);

  const scrollToTopFast = useCallback(() => {
    if (typeof window === 'undefined') return;
    // 애니메이션 없이 즉시 상단으로 이동
    window.scrollTo(0, 0);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const copyMonthDataToClipboard = useCallback(async () => {
    if (process.env.NODE_ENV !== 'development') return;
    try {
      const payload = {
        month: dayjs(date).format('YYYY-MM'),
        user:
          typeof window !== 'undefined'
            ? window.localStorage.getItem('loginInfo')
            : undefined,
        total: adjustedData.total,
        totalLength: adjustedData.totalLength,
        items: originData || [],
      };
      const text = JSON.stringify(payload, null, 2);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      console.log('월 데이터가 클립보드에 복사되었습니다.');
      setToast('월 데이터가 클립보드에 복사되었습니다.');
      setTimeout(() => setToast(null), 1500);
    } catch (err) {
      console.error(err);
      setToast('복사 실패. 콘솔을 확인하세요.');
      setTimeout(() => setToast(null), 1500);
    }
  }, [date, originData, adjustedData]);

  const [highlightUpdated, setHighlightUpdated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const showSkeleton = loading && !originData;
  const handleSearch = useCallback(() => {
    const login = window.localStorage.getItem('loginInfo');
    if (!login) return;
    const cacheKey = `card-usages:${login}:allData`;

    // 1) 로컬 캐시 먼저 반영
    let hadCache = false;
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedAll: IOriginData[] = Array.isArray(parsed)
          ? parsed
          : parsed?.allData;
        if (cachedAll && Array.isArray(cachedAll)) {
          setAllData(cachedAll);
          // 월별 파생 데이터 계산
          const loginTrim = login.trim();
          const month = dayjs(date);
          const monthItems = cachedAll
            .filter(
              (i) =>
                i.user &&
                i.user.trim() === loginTrim &&
                dayjs(i.date).isSame(month, 'month') &&
                i.time > '10:00:00' &&
                i.time < '16:00:00' &&
                parseInt(i.fee.toString(), 0) <= 20000
            )
            .map((i) =>
              i.confirmType === '취소'
                ? { ...i, fee: String(-Math.abs(parseInt(i.fee as any, 10))) }
                : i
            );
          const approved = monthItems.filter((i) => i.confirmType !== '취소');
          const sum = approved.reduce(
            (acc, i) => acc + (parseInt(i.fee as any, 10) || 0),
            0
          );
          setOriginData(monthItems);
          setTotal(sum);
          setTotalLength(approved.length);
          hadCache = true;
        }
      }
    } catch {}

    // 2) 최신 데이터 페치
    if (!hadCache) setLoading(true);
    fetch(`/api/get-total-fee?name=${login}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setAllData(data.allData);
        // 최신 allData로 파생 데이터 재계산
        const loginTrim = login.trim();
        const month = dayjs(date);
        const monthItems = (data.allData || [])
          .filter(
            (i: IOriginData) =>
              i.user &&
              i.user.trim() === loginTrim &&
              dayjs(i.date).isSame(month, 'month') &&
              i.time > '10:00:00' &&
              i.time < '16:00:00' &&
              parseInt(i.fee.toString(), 0) <= 20000
          )
          .map((i: IOriginData) =>
            i.confirmType === '취소'
              ? { ...i, fee: String(-Math.abs(parseInt(i.fee as any, 10))) }
              : i
          );
        const approved = monthItems.filter(
          (i: IOriginData) => i.confirmType !== '취소'
        );
        const sum = approved.reduce(
          (acc: number, i: IOriginData) =>
            acc + (parseInt(i.fee as any, 10) || 0),
          0
        );
        setOriginData(monthItems);
        setTotal(sum);
        setTotalLength(approved.length);
        try {
          window.localStorage.setItem(
            cacheKey,
            JSON.stringify(data.allData || [])
          );
        } catch {}
        if (hadCache) {
          setHighlightUpdated(true);
          setTimeout(() => setHighlightUpdated(false), 2000);
        }
      })
      .finally(() => {
        setLoading(false);
      });
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
      fetchExcludedItems();
      setHasSession(true);
      // 탭 전환 외에도 월 변경 시 상단으로 스크롤 이동
      scrollToTopFast();
    } else {
      setHasSession(false);
    }
  }, [date, handleSearch, fetchExcludedItems, scrollToTopFast]);
  useEffect(() => {
    if (!출근일) return;
    const 지원가능일수 = Math.min(출근일.length, 12);
    const 남은지원일수 = Math.max(0, 지원가능일수 - adjustedData.usedDays);
    set남은일수(남은지원일수);

    // 지원 불가 출근일 계산 (현재 월만)
    const 오늘 = dayjs().format('YYYY-MM-DD');
    const 오늘먹음 = originData?.some(
      (i: any) => 오늘 === i.date && !excludedIds.has(i.id) && i.confirmType !== '취소'
    );
    const 남은출근일목록 = 출근일
      .filter((i: string) => 오늘 <= i)
      .filter((i: string) => !(오늘먹음 && i === 오늘))
      .sort();
    if (남은출근일목록.length > 남은지원일수) {
      set미지원출근일(남은출근일목록.slice(남은지원일수));
    } else {
      set미지원출근일([]);
    }
  }, [originData, 출근일, adjustedData.usedDays, excludedIds]);
  const isCurrentMonth = dayjs(date).isSame(dayjs(), 'month');
  const remainingAmount = 월지원급액한도 - adjustedData.total;
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

  // 추가 인사이트 계산 (통계 탭용)
  const insights = useMemo(() => {
    const result: {
      weekdayLines: string[];
      trendLine?: string;
      burstLine?: string;
      cheapTop5: { place: string; avg: number }[];
      priceyTop5: { place: string; avg: number }[];
      badges: { master: string[]; casual: string[] };
    } = {
      weekdayLines: [],
      cheapTop5: [],
      priceyTop5: [],
      badges: { master: [], casual: [] },
    };

    if (!allData) return result;
    const login =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('loginInfo')
        : '';
    const baseFiltered = allData
      .filter((i) =>
        statsUserOnly && login ? i.user.trim() === (login || '').trim() : true
      )
      .filter((i) => i.confirmType !== '취소')
      .filter((i) => i.time > '10:00:00' && i.time < '16:00:00');

    // 1) 요일별 패턴 (월~금)
    const yoilName: Record<number, string> = {
      1: '월',
      2: '화',
      3: '수',
      4: '목',
      5: '금',
    };
    for (let d = 1; d <= 5; d += 1) {
      const byDay = baseFiltered.filter((i) => dayjs(i.date).day() === d);
      const map = new Map<string, number>();
      byDay.forEach((i) =>
        map.set(i.place || '기타', (map.get(i.place || '기타') || 0) + 1)
      );
      let best: string | null = null;
      let bestCount = 0;
      map.forEach((cnt, p) => {
        if (cnt > bestCount) {
          best = p;
          bestCount = cnt;
        }
      });
      if (best && bestCount > 0) {
        result.weekdayLines.push(`${yoilName[d]}요일엔 ${best} 많이 감`);
      }
    }

    // 2) 트렌드 (최근 3개월 기준 증가세가 가장 큰 곳)
    const base = dayjs(date);
    const months = [base.subtract(2, 'month'), base.subtract(1, 'month'), base];
    const trendMap = new Map<string, number[]>();
    baseFiltered.forEach((i) => {
      const idx = months.findIndex((m) => dayjs(i.date).isSame(m, 'month'));
      if (idx === -1) return;
      const key = i.place || '기타';
      const arr = trendMap.get(key) || [0, 0, 0];
      arr[idx] += 1;
      trendMap.set(key, arr);
    });
    let bestPlace: string | null = null;
    let bestArr: number[] | null = null;
    let maxSlope = -Infinity;
    trendMap.forEach((arr, p) => {
      const slope = arr[2] - arr[0];
      if (slope > maxSlope) {
        maxSlope = slope;
        bestPlace = p;
        bestArr = arr;
      }
    });
    if (bestArr && maxSlope > 0 && bestPlace) {
      result.trendLine = `요즘 ${bestPlace} 주가 상승 중 🔥 (최근 3개월 ${(
        bestArr as number[]
      ).join(' → ')})`;
    }

    // 3) 폭주 기록 (같은 날 같은 집 2회 이상)
    const dayPlaceCount = new Map<string, number>();
    baseFiltered.forEach((i) => {
      const key = `${i.date}::${i.place}`;
      dayPlaceCount.set(key, (dayPlaceCount.get(key) || 0) + 1);
    });
    let rbDate: string | null = null;
    let rbPlace = '';
    let rbCount = 0;
    dayPlaceCount.forEach((cnt, key) => {
      if (cnt >= 2) {
        const [d, p] = key.split('::');
        if (!rbDate || dayjs(d).isAfter(rbDate)) {
          rbDate = d;
          rbPlace = p;
          rbCount = cnt;
        }
      }
    });
    if (rbDate && rbCount >= 2) {
      result.burstLine = `${dayjs(rbDate).format(
        'M월 D일'
      )} ${rbPlace} ${rbCount}번… 이 날 무슨 일? 😅`;
    }

    // 4) 가성비 랭킹 (평균 금액 낮은/높은 TOP5)
    const feeMap = new Map<string, { sum: number; cnt: number }>();
    baseFiltered.forEach((i) => {
      const key = i.place || '기타';
      const prev = feeMap.get(key) || { sum: 0, cnt: 0 };
      feeMap.set(key, {
        sum: prev.sum + (parseInt(i.fee as any, 10) || 0),
        cnt: prev.cnt + 1,
      });
    });
    const feeArr = Array.from(feeMap.entries()).map(([place, v]) => ({
      place,
      avg: v.cnt ? v.sum / v.cnt : 0,
    }));
    const cheapTop5 = [...feeArr].sort((a, b) => a.avg - b.avg).slice(0, 5);
    const priceyTop5 = [...feeArr].sort((a, b) => b.avg - a.avg).slice(0, 5);
    result.cheapTop5 = cheapTop5;
    result.priceyTop5 = priceyTop5;

    // 5) 배지 (단골 마스터 10+, 어쩌다 손님 1)
    const countMap = new Map<string, number>();
    baseFiltered.forEach((i) =>
      countMap.set(
        i.place || '기타',
        (countMap.get(i.place || '기타') || 0) + 1
      )
    );
    const master: string[] = [];
    const casual: string[] = [];
    countMap.forEach((cnt, p) => {
      if (cnt >= 10) master.push(p);
      if (cnt === 1) casual.push(p);
    });
    result.badges = { master, casual };

    return result;
  }, [allData, statsUserOnly, date]);

  // AI 인사이트 비활성화 (요청에 따라 주석 처리)
  // useEffect(() => {
  //   if (!showStats) return;
  //   const key = `${dayjs(date).format('YYYY-MM')}:${statsUserOnly ? 'me' : 'all'}`;
  //   if (aiInsightKey === key && aiInsightText) return;
  //   setAiInsightKey(key);
  //   setAiInsightLoading(true);
  //   setAiInsightText(null);
  //   const payload = { month: dayjs(date).format('YYYY-MM') } as any;
  //   fetch('/api/ai-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  //     .then((r) => (r.ok ? r.json() : Promise.reject(r)))
  //     .then((d) => { if (d?.text) setAiInsightText(String(d.text)); })
  //     .catch(() => {})
  //     .finally(() => setAiInsightLoading(false));
  // }, [showStats, date, statsUserOnly, insights, aiInsightKey, aiInsightText]);
  useEffect(() => {
    // 홈 탭 진입시 2초간 비홈 헤더 형태(삼성점자) 보여주고 월 네비게이터로 전환
    if (showHome) {
      setHomeHeaderIntro(true);
      const timer = setTimeout(() => setHomeHeaderIntro(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showHome]);

  useEffect(() => {
    const onLogin = () => {
      const loginInfo = window.localStorage.getItem('loginInfo');
      if (!loginInfo) return;
      fetchExcludedItems();
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
  }, [date, handleSearch, fetchExcludedItems]);
  if (hasSession) {
    return (
      <div className="min-h-screen">
        {/* Seasonal effect: toggle-able for debug */}
        {!hideSeasonal &&
          (process.env.NODE_ENV === 'development' ? (
            currentSeason === 'summer' ? null : (
              <SeasonalEffect season={currentSeason} />
            )
          ) : (
            (() => {
              const show = Math.random() < 0.1; // 10% 확률
              if (!show) return null;
              return currentSeason === 'summer' ? null : (
                <SeasonalEffect season={currentSeason} />
              );
            })()
          ))}
        <div className="sticky top-0 z-20 glass glassSolid px-2">
          <div className="max-w-2xl mx-auto h-16 flex items-center">
            {showHome && homeHeaderIntro ? (
              // 홈 첫 2초: 삼성점자 헤더(비홈 형태) 표시
              <div
                className={`px-3 w-full flex items-center justify-center text-center`}
              >
                <div className="flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                    <Twemoji emoji="🍜" size={26} className="mr-2" />
                    {'삼성점자'.split('').map((ch, i) => (
                      <span
                        key={`title-ch-intro-${i}`}
                        className="letter-pop"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  <div className="subText text-[8px] anim-slide-right">
                    <span className="fg">삼</span>
                    <span className="fg">성</span>동에서{' '}
                    <span className="fg">점</span>심 맛있게 먹
                    <span className="fg">자</span>
                  </div>
                </div>
              </div>
            ) : showHome ? (
              <div className="px-3 w-full flex items-center justify-between gap-2">
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
                <div className="flex-1 text-center anim-soft">
                  <div
                    className="hover:cursor-pointer text-red text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight"
                    onClick={() => {
                      setDate(dayjs().format('YYYY-MM-DD'));
                    }}
                  >
                    {(() => {
                      const m = parseInt(dayjs(date).format('M'), 10);
                      const buckets: Record<string, string[]> = {
                        spring: ['🌸', '🌷', '🌿', '🍀'],
                        summer: ['☀️', '🌊', '🍉', '🧊'],
                        autumn: ['🍁', '🍂', '🎃', '🧣'],
                        winter: ['❄️', '⛄️', '🎄', '🔥'],
                      };
                      const season =
                        m >= 3 && m <= 5
                          ? 'spring'
                          : m >= 6 && m <= 8
                          ? 'summer'
                          : m >= 9 && m <= 11
                          ? 'autumn'
                          : 'winter';
                      const arr = buckets[season];
                      const key = `${dayjs(date).format('YYYY-MM')}-${season}`;
                      const hash = Array.from(key).reduce(
                        (h, ch) => (h << 5) - h + ch.charCodeAt(0),
                        0
                      );
                      const idx = Math.abs(hash) % arr.length;
                      const pick = arr[idx];
                      return (
                        <>
                          <Twemoji emoji={pick} size={20} className="mr-1" />
                          {`${m}월`}
                        </>
                      );
                    })()}
                  </div>
                  <div className="subText text-[10px] mt-0.5 anim-soft">
                    {monthTagline}
                  </div>
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
            ) : (
              <div
                className={`px-3 w-full flex items-center justify-center text-center ${
                  showHome ? '' : 'anim-flip'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                    <Twemoji emoji="🍜" size={26} className="mr-2" />
                    {'삼성점자'.split('').map((ch, i) => (
                      <span
                        key={`title-ch-${i}`}
                        className="letter-pop"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  {/* Subtext slides from right; could swap to other variants by time */}
                  <div className="subText text-[8px] anim-slide-right">
                    <span className="fg">삼</span>
                    <span className="fg">성</span>동에서{' '}
                    <span className="fg">점</span>심 맛있게 먹
                    <span className="fg">자</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 mt-3 sm:mt-4 flex flex-col items-center text-center gap-6 pb-24">
          {showHome && (
            <div
              className={`surface w-full max-w-2xl p-6 rounded-2xl ${
                process.env.NODE_ENV === 'development' ? 'cursor-copy' : ''
              } ${highlightUpdated ? 'updatedPulse' : ''}`}
              onClick={() => {
                if (process.env.NODE_ENV === 'development') {
                  copyMonthDataToClipboard();
                }
              }}
            >
              <div className="subText text-2xl font-light">총 사용금액</div>
              {showSkeleton ? (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="skeleton h-8 w-40" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ) : (
                <div className="text-4xl font-semibold mb-4">{`${adjustedData.total.toLocaleString(
                  'ko-KR'
                )}원`}</div>
              )}
            </div>
          )}
          {showHome && (
            <div className="surface w-full max-w-2xl p-6 rounded-2xl flex flex-col gap-6 anim-slide-up">
              <div>
                <div className="subText text-2xl font-light">총 사용건수</div>
                {showSkeleton ? (
                  <div className="skeleton h-6 w-24 mt-2" />
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {adjustedData.totalLength}건
                  </div>
                )}
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  건당 평균 금액
                </div>
                {showSkeleton ? (
                  <div className="skeleton h-6 w-36 mt-2" />
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {`${(adjustedData.totalLength === 0
                      ? 0
                      : adjustedData.total / adjustedData.totalLength
                    ).toLocaleString('ko-KR')}원`}
                  </div>
                )}
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">남은 금액</div>
                {showSkeleton ? (
                  <div className="skeleton h-6 w-40 mt-2" />
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {`${(월지원급액한도 - adjustedData.total).toLocaleString(
                      'ko-KR'
                    )}원`}
                  </div>
                )}
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">남은 지원일수</div>
                {showSkeleton ? (
                  <div className="skeleton h-6 w-16 mt-2" />
                ) : (
                  <>
                    <div className="text-4xl font-semibold mb-1">
                      {남은일수}일
                    </div>
                    <div className="subText text-sm">
                      {adjustedData.usedDays}일 사용 / {출근일 ? Math.min(출근일.length, 12) : '-'}일 지원
                    </div>
                    {isCurrentMonth && 미지원출근일.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--surface-alt, rgba(255,150,50,0.08))' }}>
                        <div className="text-sm font-medium mb-2" style={{ color: 'var(--warning, #f59e0b)' }}>
                          지원 불가 {미지원출근일.length}일
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {미지원출근일.map((d) => (
                            <span
                              key={d}
                              className="text-xs px-2 py-1 rounded-md subText"
                              style={{ background: 'var(--surface-alt, rgba(255,150,50,0.12))' }}
                            >
                              {dayjs(d).format('M/D(dd)')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  일평균 사용 가능 금액
                </div>
                {showSkeleton ? (
                  <div className="skeleton h-6 w-44 mt-2" />
                ) : (
                  <div className="text-4xl font-semibold mb-4">
                    {dailyBudget === null
                      ? '—'
                      : `${dailyBudget.toLocaleString('ko-KR')}원`}
                  </div>
                )}
              </div>
            </div>
          )}
          {showHome && (
            <div className="w-full max-w-2xl flex flex-col gap-2 anim-slide-up">
              {showSkeleton ? (
                <>
                  <div className="surface rounded-xl p-4">
                    <div className="skeleton h-5 w-1/2 mb-2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                  <div className="surface rounded-xl p-4">
                    <div className="skeleton h-5 w-2/3 mb-2" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                </>
              ) : (
                originData?.map((item) => {
                  const isExcluded = excludedIds.has(item.id);
                  return (
                  <SwipeableListItem
                    key={item.id}
                    itemId={item.id}
                    isExcluded={isExcluded}
                    disabled={item.confirmType === '취소'}
                    onToggleExclude={() => toggleExclude(item.id)}
                    openId={swipeOpenId}
                    setOpenId={setSwipeOpenId}
                    onTap={() => {
                      setSelectedItem(item);
                      setIsModalOpen(true);
                    }}
                  >
                    <div
                      className={`surface p-4 flex justify-between items-center cursor-pointer ${isExcluded ? 'opacity-40' : ''}`}
                    >
                      <div className="flex flex-col gap-1 items-start">
                        <div
                          className={`text-lg max-w-[60vw] sm:max-w-[480px] truncate ${
                            item.confirmType === '취소' || isExcluded
                              ? 'line-through subText'
                              : ''
                          }`}
                        >
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
                          {isExcluded && (
                            <div className="rounded-full whitespace-nowrap surface text-[10px] px-2 py-[2px]">
                              집계제외
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        className={`text-right text-lg font-semibold ${
                          item.confirmType === '취소' || isExcluded
                            ? 'line-through subText'
                            : ''
                        }`}
                      >{`${parseInt(item.fee).toLocaleString('ko-kr')}원`}</div>
                    </div>
                  </SwipeableListItem>
                  );
                })
              )}
            </div>
          )}
          {showRecommend && (
            <div className="w-full max-w-2xl flex flex-col gap-3 anim-slide-up">
              <div className="surface rounded-2xl p-4">
                {showSkeleton && !allData ? (
                  <>
                    <div className="skeleton h-6 w-40 mb-2" />
                    <div className="skeleton h-8 w-56" />
                    <div className="skeleton h-3 w-2/3 mt-3" />
                  </>
                ) : (
                  <Recommend allData={allData} date={date} />
                )}
              </div>
              <div className="surface rounded-2xl p-2" id="ad-banner-recommend">
                <AdBanner slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT || ''} />
              </div>
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
                    onClick={() => {
                      const loginInfo =
                        window.localStorage.getItem('loginInfo');
                      if (!loginInfo) {
                        router.push('/login');
                        return;
                      }
                      setStatsUserOnly(true);
                    }}
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
                  {showSkeleton ? (
                    <>
                      <div className="skeleton h-4 w-3/5" />
                      <div className="skeleton h-4 w-2/3" />
                      <div className="skeleton h-4 w-1/2" />
                    </>
                  ) : (
                    top5Stats.map((s) => (
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
                    ))
                  )}
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">
                  최소 방문 Top 5
                </div>
                <div className="flex flex-col gap-2">
                  {showSkeleton ? (
                    <>
                      <div className="skeleton h-4 w-2/3" />
                      <div className="skeleton h-4 w-1/2" />
                      <div className="skeleton h-4 w-3/5" />
                    </>
                  ) : (
                    bottom5Stats.map((s) => (
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
                    ))
                  )}
                </div>
              </div>
              {/* Insights */}
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">인사이트</div>
                <div className="flex flex-col gap-2 text-sm">
                  {aiInsightLoading && (
                    <div className="subText">AI 인사이트 생성 중…</div>
                  )}
                  {aiInsightText && (
                    <div className="text-left whitespace-pre-wrap subText">
                      {aiInsightText}
                    </div>
                  )}
                  {insights.weekdayLines.map((t, i) => (
                    <div key={`weekday-${i}`} className="subText">
                      {t}
                    </div>
                  ))}
                  {insights.trendLine && (
                    <div className="subText">{insights.trendLine}</div>
                  )}
                  {insights.burstLine && (
                    <div className="subText">{insights.burstLine}</div>
                  )}
                  {(insights.badges.master.length > 0 ||
                    insights.badges.casual.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {insights.badges.master.slice(0, 3).map((p) => (
                        <span
                          key={`m-${p}`}
                          className="opposite px-2 py-1 rounded-full text-xs"
                        >
                          단골 마스터 · {p}
                        </span>
                      ))}
                      {insights.badges.casual.slice(0, 3).map((p) => (
                        <span
                          key={`c-${p}`}
                          className="surface px-2 py-1 rounded-full text-xs"
                        >
                          어쩌다 손님 · {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {(insights.cheapTop5.length > 0 ||
                    insights.priceyTop5.length > 0) && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <div className="text-xs mb-1">가성비 TOP5</div>
                        {insights.cheapTop5.map((x) => (
                          <div
                            key={`ch-${x.place}`}
                            className="flex justify-between subText text-xs"
                          >
                            <span className="truncate mr-2">{x.place}</span>
                            <span>{`${Math.round(x.avg).toLocaleString(
                              'ko-KR'
                            )}원`}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-xs mb-1">고가 TOP5</div>
                        {insights.priceyTop5.map((x) => (
                          <div
                            key={`pr-${x.place}`}
                            className="flex justify-between subText text-xs"
                          >
                            <span className="truncate mr-2">{x.place}</span>
                            <span>{`${Math.round(x.avg).toLocaleString(
                              'ko-KR'
                            )}원`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">전체 목록</div>
                <div className="flex justify-end mb-2">
                  <button
                    className="button px-3 py-1 text-xs"
                    onClick={() => setShowAllList((v) => !v)}
                  >
                    {showAllList ? '접기' : '펼치기'}
                  </button>
                </div>
                {showAllList && (
                  <div className="flex flex-col gap-2">
                    {showSkeleton ? (
                      <>
                        <div className="skeleton h-4 w-3/5" />
                        <div className="skeleton h-4 w-4/5" />
                        <div className="skeleton h-4 w-2/3" />
                      </>
                    ) : (
                      placeStats.map((s) => (
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
                          <div className="w-10 text-right text-sm">
                            {s.count}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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
                className={`surface w-full sm:w-auto max-w-md sm:rounded-2xl rounded-t-2xl px-5 pt-5 safeAreaPB m-0 sm:m-4 transition-all duration-200 ${
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
                {selectedItem.confirmType !== '취소' && (
                  <button
                    className={`mt-4 w-full rounded-xl p-3 flex items-center justify-center gap-2 text-sm ${
                      excludedIds.has(selectedItem.id)
                        ? 'opposite'
                        : 'surface'
                    }`}
                    onClick={() => toggleExclude(selectedItem.id)}
                  >
                    {excludedIds.has(selectedItem.id) ? (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>집계에 포함하기</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>집계에서 제외하기</span>
                      </>
                    )}
                  </button>
                )}
                {/* 배경 클릭으로 닫힘 */}
              </div>
            </div>
          )}
          <div className="h-10" />
        </div>
        {toast && <div className="toast anim-fade">{toast}</div>}
        {/* 개발용 스켈레톤 보기 기능 제거 */}

        {/* 설정 모달 */}
        {isSettingsOpen && (
          <div
            className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 transition-opacity duration-200 opacity-100`}
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              className={`surface w-full sm:w-auto max-w-md sm:rounded-2xl rounded-t-2xl px-5 pt-5 safeAreaPB m-0 sm:m-4 transition-all duration-200 translate-y-0 opacity-100`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xl font-bold mb-3">설정</div>
              <div className="flex flex-col gap-2">
                <button
                  className="surface rounded-xl p-4 flex items-center gap-2 hover:opacity-90"
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
                  <Moon className="w-5 h-5" />
                  <span>라이트/다크 전환</span>
                </button>
                <button
                  className="surface rounded-xl p-4 flex items-center gap-2 hover:opacity-90"
                  onClick={() => {
                    window.localStorage.removeItem('loginInfo');
                    setHasSession(false);
                    setIsSettingsOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5" />
                  <span>로그아웃</span>
                </button>
                {process.env.NODE_ENV === 'development' &&
                  typeof window !== 'undefined' &&
                  window.localStorage.getItem('loginInfo') === '김지환' && (
                    <div className="surface rounded-xl p-4 flex flex-col gap-2">
                      <div className="text-sm font-semibold">디버그 도구</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <button
                          className="button"
                          onClick={() => setHideSeasonal((v) => !v)}
                        >
                          시즌 이펙트 {hideSeasonal ? '보이기' : '숨기기'}
                        </button>
                        <button
                          className="button"
                          onClick={() => {
                            try {
                              const login =
                                window.localStorage.getItem('loginInfo');
                              if (login) {
                                window.localStorage.removeItem(
                                  `card-usages:${login}:allData`
                                );
                              }
                            } catch {}
                          }}
                        >
                          캐시 삭제
                        </button>
                        <button
                          className="button"
                          onClick={() => {
                            const ev = new CustomEvent('force-reco');
                            window.dispatchEvent(ev);
                          }}
                        >
                          추천 새로고침
                        </button>
                        <button
                          className="button"
                          onClick={() => scrollToTopFast()}
                        >
                          상단으로
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
        <div className="fixed left-0 right-0 bottom-0 glass glassSolid pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="w-full px-0 py-2 grid grid-cols-4 gap-0">
            <button
              className={`tabItem w-full ${showHome ? 'tabItemActive' : ''}`}
              onClick={() => {
                setShowHome(true);
                setShowStats(false);
                setShowRecommend(false);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <HomeIcon className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${showStats ? 'tabItemActive' : ''}`}
              onClick={() => {
                setShowHome(false);
                setShowRecommend(false);
                setShowStats(true);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <BarChart2 className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${
                showRecommend ? 'tabItemActive' : ''
              }`}
              onClick={() => {
                setShowHome(false);
                setShowStats(false);
                setShowRecommend(true);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <Utensils className="w-5 h-5" />
              </div>
            </button>
            <button
              className="tabItem w-full"
              onClick={() => setIsSettingsOpen(true)}
            >
              <div className="flex items-center gap-1 text-xs">
                <Menu className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 로그인되지 않은 경우 가상 데이터로 홈 화면 표시
  if (!hasSession) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-20 glass glassSolid px-2">
          <div className="max-w-2xl mx-auto h-16 flex items-center">
            <div className="px-3 w-full flex items-center justify-between gap-2">
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
              <div className="flex-1 text-center anim-soft">
                <div
                  className="hover:cursor-pointer text-red text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight"
                  onClick={() => {
                    setDate(dayjs().format('YYYY-MM-DD'));
                  }}
                >
                  {(() => {
                    const m = parseInt(dayjs(date).format('M'), 10);
                    const buckets: Record<string, string[]> = {
                      spring: ['🌸', '🌷', '🌿', '🍀'],
                      summer: ['☀️', '🌊', '🍉', '🧊'],
                      autumn: ['🍁', '🍂', '🎃', '🧣'],
                      winter: ['❄️', '⛄️', '🎄', '🔥'],
                    };
                    const season =
                      m >= 3 && m <= 5
                        ? 'spring'
                        : m >= 6 && m <= 8
                        ? 'summer'
                        : m >= 9 && m <= 11
                        ? 'autumn'
                        : 'winter';
                    const arr = buckets[season];
                    const key = `${dayjs(date).format('YYYY-MM')}-${season}`;
                    const hash = Array.from(key).reduce(
                      (h, ch) => (h << 5) - h + ch.charCodeAt(0),
                      0
                    );
                    const idx = Math.abs(hash) % arr.length;
                    const pick = arr[idx];
                    return (
                      <>
                        <Twemoji emoji={pick} size={20} className="mr-1" />
                        {`${m}월`}
                      </>
                    );
                  })()}
                </div>
                <div className="subText text-[10px] mt-0.5 anim-soft">
                  {monthTagline}
                </div>
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
          {/* 로그인 유도 배너 */}
          <div className="surface w-full max-w-2xl p-6 rounded-2xl border-2 border-dashed border-[rgb(var(--border))]">
            <div className="text-lg font-semibold mb-2">
              🍜 삼성점자 체험하기
            </div>
            <div className="subText text-sm mb-4">
              현재 가상 데이터를 보고 있습니다. 실제 데이터를 보려면
              로그인해주세요!
            </div>
            <button
              className="button opposite px-6 py-2 rounded-xl"
              onClick={() => router.push('/login')}
            >
              로그인하기
            </button>
          </div>

          {/* 가상 데이터 표시 */}
          {showHome && (
            <div className="surface w-full max-w-2xl p-6 rounded-2xl">
              <div className="subText text-2xl font-light">총 사용금액</div>
              <div className="text-4xl font-semibold mb-4">45,000원</div>
            </div>
          )}

          {showHome && (
            <div className="surface w-full max-w-2xl p-6 rounded-2xl flex flex-col gap-6 anim-slide-up">
              <div>
                <div className="subText text-2xl font-light">총 사용건수</div>
                <div className="text-4xl font-semibold mb-4">8건</div>
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  건당 평균 금액
                </div>
                <div className="text-4xl font-semibold mb-4">5,625원</div>
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">남은 금액</div>
                <div className="text-4xl font-semibold mb-4">99,000원</div>
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">남은 일수</div>
                <div className="text-4xl font-semibold mb-4">15일</div>
              </div>
              <div className="divider" />
              <div>
                <div className="subText text-2xl font-light">
                  일평균 사용 가능 금액
                </div>
                <div className="text-4xl font-semibold mb-4">6,600원</div>
              </div>
            </div>
          )}

          {/* 가상 사용 내역 */}
          {showHome && (
            <div className="w-full max-w-2xl flex flex-col gap-2 anim-slide-up">
              {[
                {
                  place: '김치찌개집',
                  date: '2024-01-15',
                  time: '12:30',
                  fee: '8000',
                  confirmType: '승인',
                },
                {
                  place: '돈까스집',
                  date: '2024-01-14',
                  time: '13:15',
                  fee: '12000',
                  confirmType: '승인',
                },
                {
                  place: '라면집',
                  date: '2024-01-13',
                  time: '12:45',
                  fee: '6000',
                  confirmType: '승인',
                },
                {
                  place: '치킨집',
                  date: '2024-01-12',
                  time: '13:00',
                  fee: '15000',
                  confirmType: '승인',
                },
                {
                  place: '분식집',
                  date: '2024-01-11',
                  time: '12:20',
                  fee: '5000',
                  confirmType: '승인',
                },
              ].map((item, index) => (
                <div
                  className="surface p-4 rounded-xl flex justify-between items-center hover:opacity-95 cursor-pointer opacity-60"
                  key={`demo-${index}`}
                >
                  <div className="flex flex-col gap-1 items-start">
                    <div className="text-lg max-w-[60vw] sm:max-w-[480px] truncate">
                      {item.place}
                    </div>
                    <div className="flex gap-2 subText items-center text-sm flex-nowrap">
                      <div>{dayjs(item.date).format('YY.M.DD')}</div>
                      <div>{item.time}</div>
                      <div className="opposite text-[10px] px-2 py-[2px] rounded-full whitespace-nowrap">
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

          {/* 통계 페이지 */}
          {showStats && (
            <div className="w-full max-w-2xl flex flex-col gap-4 anim-slide-up">
              <div className="surface rounded-2xl p-3 flex justify-center">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    className="tabItem"
                    onClick={() => router.push('/login')}
                  >
                    내 통계 (로그인 필요)
                  </button>
                  <div className="divider w-px h-5" />
                  <button className="tabItem tabItemActive">전체 통계</button>
                </div>
              </div>
              <div className="surface rounded-2xl p-4">
                <div className="text-lg font-semibold mb-2">
                  최다 방문 Top 5
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { place: '김치찌개집', count: 15 },
                    { place: '돈까스집', count: 12 },
                    { place: '라면집', count: 10 },
                    { place: '치킨집', count: 8 },
                    { place: '분식집', count: 6 },
                  ].map((s) => (
                    <div
                      key={`demo-top-${s.place}`}
                      className="flex items-center gap-3"
                    >
                      <div className="text-sm truncate w-32 sm:w-48">
                        {s.place}
                      </div>
                      <div className="flex-1 h-3 surface rounded-full overflow-hidden">
                        <div
                          className="h-full opposite rounded-full"
                          style={{ width: `${(s.count / 15) * 100}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-sm">{s.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 추천 페이지 */}
          {showRecommend && (
            <div className="w-full max-w-2xl flex flex-col gap-3 anim-slide-up">
              <div className="surface rounded-2xl p-4">
                <div className="text-xl font-bold mb-4">오늘의 점심 추천</div>
                <div className="text-center py-8">
                  <div className="text-lg mb-4">
                    🍜 나에게 딱 맞는 점심 추천
                  </div>
                  <div className="subText text-sm mb-6">
                    로그인하면 개인 맞춤 추천을 받을 수 있어요!
                  </div>
                  <button
                    className="button opposite px-6 py-3 rounded-xl"
                    onClick={() => router.push('/login')}
                  >
                    로그인하고 추천받기
                  </button>
                </div>
              </div>
              <div className="surface rounded-2xl p-2">
                <AdBanner slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT || ''} />
              </div>
            </div>
          )}

          <div className="h-10" />
        </div>

        {/* 하단 네비게이션 */}
        <div className="fixed left-0 right-0 bottom-0 glass glassSolid pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="w-full px-0 py-2 grid grid-cols-4 gap-0">
            <button
              className={`tabItem w-full ${showHome ? 'tabItemActive' : ''}`}
              onClick={() => {
                setShowHome(true);
                setShowStats(false);
                setShowRecommend(false);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <HomeIcon className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${showStats ? 'tabItemActive' : ''}`}
              onClick={() => {
                setShowHome(false);
                setShowRecommend(false);
                setShowStats(true);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <BarChart2 className="w-5 h-5" />
              </div>
            </button>
            <button
              className={`tabItem w-full ${
                showRecommend ? 'tabItemActive' : ''
              }`}
              onClick={() => {
                setShowHome(false);
                setShowStats(false);
                setShowRecommend(true);
                scrollToTopFast();
              }}
            >
              <div className="flex items-center gap-1 text-xs">
                <Utensils className="w-5 h-5" />
              </div>
            </button>
            <button
              className="tabItem w-full"
              onClick={() => router.push('/login')}
            >
              <div className="flex items-center gap-1 text-xs">
                <Menu className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
