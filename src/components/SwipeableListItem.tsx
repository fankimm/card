import { useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// 내역 한 줄. 왼쪽으로 밀면 집계 제외 버튼이 나온다.
// 끝까지 밀면 바로 토글된다.
export default function SwipeableListItem({
  children,
  itemId,
  isExcluded,
  disabled,
  onToggleExclude,
  openId,
  setOpenId,
  onTap,
}: {
  children: React.ReactNode;
  itemId: string;
  isExcluded: boolean;
  disabled?: boolean;
  onToggleExclude: () => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onTap: () => void;
}) {
  const W = 72;
  const SPRING = 'transform 0.55s cubic-bezier(0.32, 0.72, 0, 1)';
  const isOpen = openId === itemId;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const t = useRef({ sx: 0, sy: 0, swiping: false, moved: false });
  const elRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen && elRef.current) {
      elRef.current.style.transition = SPRING;
      elRef.current.style.transform = 'translateX(0)';
    }
    if (btnRef.current) {
      btnRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease';
      btnRef.current.style.transform = isOpen ? 'scale(1)' : 'scale(0)';
      btnRef.current.style.opacity = isOpen ? '1' : '0';
    }
  }, [isOpen]);

  // Native touchmove listener for preventDefault (blocks vertical scroll during swipe)
  useEffect(() => {
    const el = elRef.current;
    if (!el || disabled) return;
    const onMove = (e: TouchEvent) => {
      if (t.current.swiping) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [disabled]);

  if (disabled) return <div onClick={onTap}>{children}</div>;

  const BTN_SPRING = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease';
  const doClose = () => {
    if (elRef.current) {
      elRef.current.style.transition = SPRING;
      elRef.current.style.transform = 'translateX(0)';
    }
    if (btnRef.current) {
      btnRef.current.style.transition = BTN_SPRING;
      btnRef.current.style.transform = 'scale(0)';
      btnRef.current.style.opacity = '0';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: W }}
      >
        <button
          ref={btnRef}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-semibold shadow-md ${
            isExcluded ? 'bg-blue-500' : 'bg-amber-500'
          }`}
          style={{ transform: 'scale(0)', opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExclude();
            setOpenId(null);
            doClose();
          }}
        >
          {isExcluded ? (
            <Eye className="w-5 h-5" />
          ) : (
            <EyeOff className="w-5 h-5" />
          )}
          <span>{isExcluded ? '포함' : '제외'}</span>
        </button>
      </div>
      <div
        ref={elRef}
        className="relative rounded-xl"
        style={{ background: 'rgb(var(--bg-elev))' }}
        onTouchStart={(e) => {
          t.current = {
            sx: e.touches[0].clientX,
            sy: e.touches[0].clientY,
            swiping: false,
            moved: false,
          };
          if (!isOpenRef.current && openId) setOpenId(null);
        }}
        onTouchMove={(e) => {
          const s = t.current;
          const dx = e.touches[0].clientX - s.sx;
          const dy = e.touches[0].clientY - s.sy;
          if (!s.swiping) {
            if (Math.abs(dy) > Math.abs(dx)) return;
            if (Math.abs(dx) > 8) s.swiping = true;
            else return;
          }
          s.moved = true;
          const base = isOpenRef.current ? -W : 0;
          const raw = base + dx;
          let offset: number;
          if (raw < -W) {
            offset = -(W + (-raw - W) * 0.3);
          } else {
            offset = Math.min(0, raw);
          }
          if (elRef.current) {
            elRef.current.style.transition = 'none';
            elRef.current.style.transform = `translateX(${offset}px)`;
          }
          if (btnRef.current) {
            const progress = Math.min(1, -offset / W);
            btnRef.current.style.transition = 'none';
            btnRef.current.style.transform = `scale(${progress})`;
            btnRef.current.style.opacity = String(progress);
          }
        }}
        onTouchEnd={() => {
          if (!t.current.moved) return;
          const el = elRef.current;
          if (!el) return;
          const x = new DOMMatrix(getComputedStyle(el).transform).m41;
          const cw = el.parentElement?.clientWidth || 300;
          el.style.transition = SPRING;
          const btn = btnRef.current;
          if (-x > cw * 0.55) {
            el.style.transform = `translateX(-${cw}px)`;
            setTimeout(() => {
              onToggleExclude();
              setOpenId(null);
              doClose();
            }, 350);
          } else if (x < -30) {
            el.style.transform = `translateX(-${W}px)`;
            if (btn) {
              btn.style.transition = BTN_SPRING;
              btn.style.transform = 'scale(1)';
              btn.style.opacity = '1';
            }
            setOpenId(itemId);
          } else {
            el.style.transform = 'translateX(0)';
            if (btn) {
              btn.style.transition = BTN_SPRING;
              btn.style.transform = 'scale(0)';
              btn.style.opacity = '0';
            }
            if (isOpenRef.current) setOpenId(null);
          }
        }}
        onClick={() => {
          if (t.current.moved) {
            t.current.moved = false;
            return;
          }
          if (isOpenRef.current) {
            setOpenId(null);
            return;
          }
          onTap();
        }}
      >
        {children}
      </div>
    </div>
  );
}
