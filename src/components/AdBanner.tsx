import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  slotId: string;
  layout?: 'auto' | 'responsive' | 'in-article';
}

export default function AdBanner({ slotId, layout = 'auto' }: AdBannerProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT | 'ca-pub-4567930429443718';

  useEffect(() => {
    if (!client || !slotId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [client, slotId]);

  if (!client || !slotId) {
    return (
      <div className="surface rounded-xl p-4 subText text-sm">
        광고 영역 (클라이언트/슬롯 ID가 설정되지 않았습니다)
      </div>
    );
  }

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slotId}
      data-ad-format={layout}
      data-full-width-responsive="true"
    />
  );
}
