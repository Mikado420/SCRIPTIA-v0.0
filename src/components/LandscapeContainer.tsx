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
      <div className="fixed inset-0 flex flex-col items-center justify-center z-[9999] p-8 text-center" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a1f33, #06070d 70%)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ border: '1.5px solid #d2ab5f', boxShadow: '0 0 24px rgba(230,199,127,0.25)' }}>
          <RotateCw size={44} className="text-brass-300" style={{ animation: 'sc-spin-slow 2.8s linear infinite' }} />
        </div>
        <div className="sc-eyebrow mb-2">Scriptia</div>
        <h1 className="sc-title text-[22px] mb-3">端末を横向きにしてください</h1>
        <p className="text-[13px] text-parch-300 leading-relaxed">SCRIPTIA は横画面で遊ぶカードゲームです。</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none" style={{ background: '#06070d' }}>
      {children}
    </div>
  );
};
