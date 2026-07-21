import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { isMaskedNameMatch } from '../lib/user-match';

const Login = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [card, setCard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // 이름·카드번호 입력하는 동안 데이터를 미리 받아둬서 제출 시 대기를 없앤다
  const prefetchRef = useRef<Promise<any> | null>(null);
  useEffect(() => {
    prefetchRef.current = fetch(
      `/api/get-total-fee?name=&date=${new Date().toISOString().slice(0, 10)}`
    )
      .then((res) => res.json())
      .catch(() => null);
  }, []);

  const handleLogin = async () => {
    const trimmedName = name.trim();
    const trimmedCard = card.trim();
    if (!trimmedName) return;
    if (!/^\d{4}$/.test(trimmedCard)) {
      setError('카드 뒷 4자리를 정확히 입력해주세요.');
      return;
    }
    setError(null);
    setChecking(true);
    try {
      // 방어로직: 이 카드번호로 기록된 내역의 이름이
      // 입력한 이름과 (마스킹 감안하고) 일치하는지 검증
      const data = (await prefetchRef.current) || undefined;
      const allData = (data?.allData || []) as {
        user?: string;
        cardNumber?: string;
      }[];
      const cardItems = allData.filter(
        (i) => String(i.cardNumber || '').trim() === trimmedCard
      );
      if (
        cardItems.length > 0 &&
        !cardItems.some((i) => isMaskedNameMatch(i.user, trimmedName))
      ) {
        setError('이름과 카드 번호가 일치하지 않아요.');
        setChecking(false);
        return;
      }
      // 받은 데이터를 홈 캐시에 미리 넣어 첫 화면을 즉시 그리게 한다
      if (allData.length > 0) {
        try {
          window.localStorage.setItem(
            `card-usages:${trimmedName}:allData`,
            JSON.stringify(allData)
          );
        } catch {}
      }
    } catch {
      // 검증 실패(네트워크 등) 시에는 로그인 자체는 허용
    }
    window.localStorage.setItem('loginInfo', trimmedName);
    window.localStorage.setItem('cardInfo', trimmedCard);
    window.dispatchEvent(new Event('login'));
    router.push('/');
  };

  return (
    <div className="min-h-[60vh] flex flex-col justify-center items-center px-6">
      <form
        className="surface w-full max-w-sm p-6 rounded-2xl flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <div className="text-xl font-extrabold tracking-tight">로그인</div>
        <input
          className="w-full bg-transparent border border-[rgb(var(--border))] rounded-xl px-3 py-2 outline-none"
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <input
          className="w-full bg-transparent border border-[rgb(var(--border))] rounded-xl px-3 py-2 outline-none"
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="카드 뒷 4자리"
          value={card}
          onChange={(e) => {
            setCard(e.target.value.replace(/\D/g, ''));
          }}
        />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <button
          type="submit"
          className="button opposite w-full text-center"
          disabled={checking}
        >
          {checking ? '확인 중...' : '로그인'}
        </button>
      </form>
      <div className="mt-4 text-center">
        <div className="subText text-sm mb-2">또는</div>
        <button
          className="button surface w-full max-w-sm px-6 py-2 rounded-xl"
          onClick={() => router.push('/')}
        >
          로그인 없이 체험하기
        </button>
      </div>
    </div>
  );
};

export default Login;
