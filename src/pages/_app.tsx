import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import 'dayjs/locale/ko'; // 한국어 로케일 불러오기
import dayjs from 'dayjs';
import { useState } from 'react';

dayjs.locale('ko');

export default function App({ Component, pageProps }: AppProps) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  return <Component date={date} setDate={setDate} {...pageProps} />;
}
