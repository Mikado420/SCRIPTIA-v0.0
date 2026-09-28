import React from 'react';
import { Check, AlertTriangle, Sparkles } from 'lucide-react';

export type ToastTone = 'info' | 'warn' | 'success';

/** 画面上部中央に短く出る通知。同じ文言でも key を変えれば再生し直す。 */
export const Toast: React.FC<{ text: string; tone?: ToastTone; fixed?: boolean; top?: number; duration?: number }> = ({
  text,
  tone = 'info',
  fixed = false,
  top = 44,
  duration = 1600,
}) => {
  const style =
    tone === 'success'
      ? { border: 'rgba(134,236,220,0.7)', fg: '#c9fbf2', Icon: Check }
      : tone === 'warn'
        ? { border: 'rgba(243,154,144,0.75)', fg: '#ffd9d4', Icon: AlertTriangle }
        : { border: 'rgba(230,199,127,0.65)', fg: '#f7ebc8', Icon: Sparkles };
  return (
    <div
      className="pointer-events-none left-1/2"
      style={{
        position: fixed ? 'fixed' : 'absolute',
        top,
        zIndex: 70,
        animation: `sc-toast ${duration}ms ease-out both`,
      }}
      role="status"
    >
      <div
        className="flex items-center gap-2 px-3.5 h-8 rounded-full text-[12px] font-bold whitespace-nowrap"
        style={{
          background: 'linear-gradient(180deg, rgba(22,26,41,0.97), rgba(11,13,23,0.97))',
          border: `1px solid ${style.border}`,
          color: style.fg,
          boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
        }}
      >
        <style.Icon size={14} />
        <span>{text}</span>
      </div>
    </div>
  );
};
