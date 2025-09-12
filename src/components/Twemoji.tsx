import React from 'react';

type TwemojiProps = {
  emoji: string;
  size?: number; // px
  className?: string;
  title?: string;
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
}: TwemojiProps) {
  const code = toCodePoints(emoji);
  const svgSrc = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`;
  const simpleCode = code
    .split('-')
    .filter((p) => p !== 'fe0f')
    .join('-');
  const svgNoFe0f = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${simpleCode}.svg`;
  const pngNoFe0f = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${simpleCode}.png`;
  const onError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const step = img.getAttribute('data-step') || '0';
    if (step === '0') {
      img.setAttribute('data-step', '1');
      img.src = svgNoFe0f;
      return;
    }
    if (step === '1') {
      img.setAttribute('data-step', '2');
      img.src = pngNoFe0f;
      return;
    }
    // 마지막 폴백: 시스템 이모지 텍스트로 대체
    img.onerror = null;
    img.style.display = 'none';
    const span = document.createElement('span');
    span.textContent = emoji;
    span.style.display = 'inline-block';
    span.style.verticalAlign = 'middle';
    span.style.fontSize = `${size}px`;
    img.insertAdjacentElement('afterend', span);
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={svgSrc}
      alt={title || emoji}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={onError}
    />
  );
}
