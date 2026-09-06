import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const LandscapeContainer: React.FC<Props> = ({ children }) => {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (isPortrait) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-[9999] p-8 text-center">
        <RotateCw size={64} className="animate-spin text-yellow-500 mb-6" />
        <h1 className="text-2xl font-bold mb-4 tracking-widest">画面を横向きにしてください</h1>
        <p className="text-slate-400">SCRIPTIAは横画面専用のカードゲームです。</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden select-none">
      {children}
    </div>
  );
};
