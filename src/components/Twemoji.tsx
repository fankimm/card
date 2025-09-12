import React, { useMemo, useState } from 'react';

type TwemojiProps = {
  emoji: string;
  size?: number; // px
  className?: string;
  title?: string;
  offsetEm?: number; // positive -> move up by em
};

function toCodePoints(unicode: string): string {
  const codePoints: string[] = [];
  for (const char of Array.from(unicode)) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      codePoints.push(cp.toString(16));
    }
  }
  return codePoints.join('-');
}

export default function Twemoji({
  emoji,
  size = 20,
  className,
  title,
  offsetEm = 0.06,
}: TwemojiProps) {
  const [fallbackStep, setFallbackStep] = useState<0 | 1 | 2>(0);
  const { svgSrc, svgNoFe0f, pngNoFe0f } = useMemo(() => {
    const code = toCodePoints(emoji);
    const svg = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`;
    const simpleCode = code
      .split('-')
      .filter((p) => p !== 'fe0f')
      .join('-');
    const svg2 = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${simpleCode}.svg`;
    const png = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${simpleCode}.png`;
    return { svgSrc: svg, svgNoFe0f: svg2, pngNoFe0f: png };
  }, [emoji]);
  const src =
    fallbackStep === 0 ? svgSrc : fallbackStep === 1 ? svgNoFe0f : pngNoFe0f;
  const handleError = () =>
    setFallbackStep((s) => (s === 2 ? 2 : ((s + 1) as 0 | 1 | 2)));

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title || emoji}
      width={size}
      height={size}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        transform: `translateY(-${offsetEm}em)`,
      }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}
