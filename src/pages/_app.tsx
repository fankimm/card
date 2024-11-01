import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import 'dayjs/locale/ko'; // 한국어 로케일 불러오기
import dayjs from 'dayjs';
import { useState } from 'react';

dayjs.locale('ko');
interface AppPropsWithDate extends AppProps {
  date: string;
  setDate: (date: string) => void;
}
export default function App({ Component, pageProps }: AppPropsWithDate) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  return <Component date={date} setDate={setDate} {...pageProps} />;
}
