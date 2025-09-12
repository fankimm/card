import React, { useMemo } from 'react';
import Twemoji from '@/components/Twemoji';

type Drop = {
  left: number;
  size: number;
  duration: number;
  swayDuration: number;
  delay: number;
  opacity: number;
  rotate: number;
  sway: number;
  emoji: string;
};

export default function HeatHaze() {
  const count = 26;
  const drops = useMemo<Drop[]>(() => {
    const pool = ['💧', '💦', '🫧']; // 땀방울/물방울 계열
    const arr: Drop[] = [];
    for (let i = 0; i < count; i += 1) {
      const emoji = pool[Math.floor(Math.random() * pool.length)];
      arr.push({
        left: Math.random() * 100,
        size: 14 + Math.random() * 10,
        duration: 5 + Math.random() * 12, // 5~17s
        swayDuration: 1.4 + Math.random() * 2.6, // 1.4~4.0s
        delay: Math.random() * 8,
        opacity: 0.6 + Math.random() * 0.35,
        rotate: -10 + Math.random() * 20,
        sway: 6 + Math.random() * 20,
        emoji,
      });
    }
    return arr;
  }, []);

  return (
    <div className="sweat-layer">
      {drops.map((d, i) => (
        <span
          key={`drop-${i}`}
          className="sweat-drop"
          style={{
            left: `${d.left}%`,
            animationDuration: `${d.duration}s`,
            animationDelay: `-${d.delay}s`,
            opacity: d.opacity,
            ['--sway' as any]: `${d.sway}px`,
            // 가속 낙하 느낌
            animationTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          }}
        >
          <span
            className="sweat-drop-inner"
            style={{
              animationDuration: `${d.swayDuration}s`,
              transform: `rotate(${d.rotate}deg)`,
            }}
          >
            <Twemoji emoji={d.emoji} size={Math.round(d.size)} />
          </span>
        </span>
      ))}
    </div>
  );
}
