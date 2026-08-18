import { useState, useRef } from 'react';
import { Shuffle } from 'lucide-react';
import dayjs from 'dayjs';
import { 점심시간대 } from '../lib/usage-filter';
import type { IOriginData } from '../lib/types';

// 오늘 뭐 먹지. 내 방문 이력으로 몇 가지 각도의 추천을 만든다.
export default function Recommend({
  myData,
  date,
}: {
  myData?: IOriginData[];
  date: string;
}) {
  // Hooks must be called unconditionally
  const [index, setIndex] = useState(0);
  const viewedWithoutAdRef = useRef(0);
  // 렌더마다 새로 굴리면 "랜덤 즐겨찾기"가 화면을 건드릴 때마다 바뀐다. 마운트 때 한 번만.
  const [randomSeed] = useState(() => Math.random());

  if (!myData || myData.length === 0) {
    return (
      <div className="subText">데이터가 없어 추천을 생성할 수 없어요.</div>
    );
  }
  const month = dayjs();
  // myData는 서버에서 이미 내 것만 걸러서 준다.
  const all = myData.filter(
    (i) => 점심시간대(i.time)
  );
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
    const pick = top5[Math.floor(randomSeed * top5.length)];
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
