import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import 'dayjs/locale/ko'; // 한국어 로케일 불러오기
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

dayjs.locale('ko');
interface AppPropsWithDate extends AppProps {
  date: string;
  setDate: (date: string) => void;
}
export default function App({ Component, pageProps }: AppPropsWithDate) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (typeof window !== 'undefined' &&
      (localStorage.getItem('theme') as 'dark' | 'light')) ||
      'dark'
  );
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // 예전 캐시(card-usages:이름:allData)에는 전원의 이름과 카드 뒷 4자리가 통째로
  // 들어 있었다. 서버가 더는 안 내려줘도 이미 기기에 저장된 건 남아 있으므로 지운다.
  // 어느 페이지로 들어오든 지워지도록 여기(_app)에 둔다.
  useEffect(() => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('card-usages:') && key.endsWith(':allData')) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {}
  }, []);
  return (
    <>
      <Component date={date} setDate={setDate} {...pageProps} />
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-home-indicator">
          <div className="bar" />
        </div>
      )}
    </>
  );
}
