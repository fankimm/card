import { useRouter } from 'next/router';
import { useState } from 'react';

const Login = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  return (
    <div className="min-h-[60vh] flex flex-col justify-center items-center px-6">
      <form
        className="surface w-full max-w-sm p-6 rounded-2xl flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name) return;
          window.localStorage.setItem('loginInfo', name);
          window.dispatchEvent(new Event('login'));
          router.push('/');
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!name) return;
              window.localStorage.setItem('loginInfo', name);
              window.dispatchEvent(new Event('login'));
              router.push('/');
            }
          }}
        />
        <button type="submit" className="button opposite w-full text-center">
          로그인
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
