import { useRouter } from 'next/router';
import { useState } from 'react';
import { isMaskedNameMatch } from '../lib/user-match';

const Login = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [card, setCard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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

    // 카드 재발급으로 뒷 4자리가 바뀌어도 과거 내역이 계속 보이도록,
    // 같은 사람이 쓰던 옛 카드 번호를 뒤에 이어 붙여 함께 저장한다. 맨 앞이 현재 카드.
    // 이름/카드 대조와 옛 카드 탐지는 전체 내역을 봐야 해서 서버가 한다.
    let 서버카드: string[] = [trimmedCard];
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, card: trimmedCard }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.message || '로그인에 실패했어요.');
        setChecking(false);
        return;
      }
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        서버카드 = data.cards.map(String);
      }
    } catch {
      // 네트워크 실패 시에는 로그인 자체는 허용한다
    }

    // 같은 기기에서 같은 이름으로 다시 로그인하면 전에 등록해둔 번호도 이어받는다
    const 이전등록 =
      isMaskedNameMatch(
        window.localStorage.getItem('loginInfo') || '',
        trimmedName
      ) && window.localStorage.getItem('cardInfo')
        ? (window.localStorage.getItem('cardInfo') as string).split(',')
        : [];
    const cardsToSave = Array.from(
      new Set(
        [...서버카드, ...이전등록].map((c) => c.trim()).filter(Boolean)
      )
    ).join(',');

    window.localStorage.setItem('loginInfo', trimmedName);
    window.localStorage.setItem('cardInfo', cardsToSave);
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
