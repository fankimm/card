import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#101010" />
        <meta name="apple-mobile-web-app-status-bar-style" content="#101010" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
