import React, { useMemo } from 'react';
import Twemoji from '@/components/Twemoji';

type Season = 'spring' | 'autumn' | 'winter' | 'summer';

export default function SeasonalEffect({ season }: { season: Season }) {
  const count = 29; // 36 -> ~20% 감소

  const particles = useMemo(() => {
    const emojiPool: Record<Season, string[]> = {
      spring: ['🌸', '🌼'],
      summer: ['🍉', '🌴', '🧊'],
      autumn: ['🍁', '🍂', '🎃'],
      winter: ['❄️', '⛄️', '☃️', '🎄', '🧣'],
    };
    const pool = emojiPool[season] || emojiPool.spring;
    const arr: Array<{
      left: number;
      size: number;
      duration: number; // 낙하 시간
      swayDuration: number; // 좌우 흔들림 시간
      delay: number;
      rotate: number;
      opacity: number;
      sway: number; // 좌우 흔들림 폭(px)
      emoji: string;
    }> = [];
    for (let i = 0; i < count; i += 1) {
      const emoji = pool[Math.floor(Math.random() * pool.length)];
      arr.push({
        left: Math.random() * 100,
        size:
          season === 'winter'
            ? 12 + Math.random() * 10
            : 16 + Math.random() * 12,
        duration: 6 + Math.random() * 14, // 6s ~ 20s
        swayDuration: 1.6 + Math.random() * 2.8, // 1.6s ~ 4.4s
        delay: Math.random() * 10,
        rotate: Math.random() * 360,
        opacity: 0.6 + Math.random() * 0.35,
        sway: 10 + Math.random() * (season === 'winter' ? 16 : 26),
        emoji,
      });
    }
    return arr;
  }, [season]);

  return (
    <div className="seasonal-layer">
      {particles.map((p, idx) => (
        <span
          key={`particle-${idx}`}
          className="particle"
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `-${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
            opacity: p.opacity,
            ['--sway' as any]: `${p.sway}px`,
          }}
        >
          <span
            className="particle-inner"
            style={{ animationDuration: `${p.swayDuration}s` }}
          >
            <Twemoji emoji={p.emoji} size={Math.round(p.size)} />
          </span>
        </span>
      ))}
    </div>
  );
}
