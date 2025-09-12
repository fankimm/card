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
