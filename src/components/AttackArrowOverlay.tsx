import React from 'react';

interface Props {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isLockedOn: boolean;
  targetName?: string;
}

export const AttackArrowOverlay: React.FC<Props> = ({
  startX,
  startY,
  currentX,
  currentY,
  isLockedOn,
  targetName,
}) => {
  // Calculate delta
  const dx = currentX - startX;
  const dy = currentY - startY;
  const dist = Math.hypot(dx, dy);

  if (dist < 10) return null;

  // Bezier curve control point: arch upwards
  // In screen coords, smaller Y is upwards. Arch height scales with distance.
  const midX = (startX + currentX) / 2;
  const midY = (startY + currentY) / 2;
  const archHeight = Math.min(80, Math.max(30, dist * 0.25));
  const ctrlX = midX;
  const ctrlY = midY - archHeight;

  // Tangent angle at endpoint for arrow head rotation
  // Derivative of quadratic bezier at t=1: 2 * (P2 - P1) = 2 * ((currentX - ctrlX), (currentY - ctrlY))
  const tangentX = currentX - ctrlX;
  const tangentY = currentY - ctrlY;
  const angleRad = Math.atan2(tangentY, tangentX);
  const angleDeg = (angleRad * 180) / Math.PI;

  const pathD = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${currentX} ${currentY}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible"
      style={{ filter: isLockedOn ? 'drop-shadow(0 0 12px #facc15)' : 'drop-shadow(0 0 8px #38bdf8)' }}
    >
      <defs>
        {/* Normal Arrow Gradient (Cyan to Amber) */}
        <linearGradient id="attackArrowGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#38bdf8" stopOpacity="1" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="1" />
        </linearGradient>

        {/* Lock-On Arrow Gradient (Intense Gold to Red-Orange) */}
        <linearGradient id="attackArrowGradLocked" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#eab308" stopOpacity="1" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
        </linearGradient>

        {/* Pulsing ring pattern */}
        <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background soft glow path */}
      <path
        d={pathD}
        fill="none"
        stroke={isLockedOn ? '#f59e0b' : '#0284c7'}
        strokeWidth="12"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />

      {/* Main energized neon arrow body with flowing dash */}
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${isLockedOn ? 'attackArrowGradLocked' : 'attackArrowGrad'})`}
        strokeWidth={isLockedOn ? '6.5' : '5'}
        strokeDasharray="8 5"
        strokeLinecap="round"
        className="animate-pulse"
      />

      {/* Origin pulsating circle */}
      <circle
        cx={startX}
        cy={startY}
        r="7"
        fill={isLockedOn ? '#f59e0b' : '#38bdf8'}
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle
        cx={startX}
        cy={startY}
        r="14"
        fill="none"
        stroke={isLockedOn ? '#eab308' : '#38bdf8'}
        strokeWidth="1.5"
        opacity="0.6"
        className="animate-ping"
      />

      {/* Arrowhead at target tip */}
      <g transform={`translate(${currentX}, ${currentY}) rotate(${angleDeg})`}>
        {/* Sharp Triangle Head */}
        <path
          d="M -16 -10 L 4 0 L -16 10 L -10 0 Z"
          fill={isLockedOn ? '#ef4444' : '#facc15'}
          stroke="#ffffff"
          strokeWidth="1.5"
          filter="url(#glowFilter)"
        />
      </g>

      {/* Target Reticle when locked-on */}
      {isLockedOn && (
        <g transform={`translate(${currentX}, ${currentY})`}>
          {/* Outer rotating crosshair ring */}
          <circle
            cx="0"
            cy="0"
            r="22"
            fill="none"
            stroke="#facc15"
            strokeWidth="2"
            strokeDasharray="6 4"
            className="animate-spin"
            style={{ animationDuration: '4s' }}
          />
          {/* Inner pulsating target ring */}
          <circle
            cx="0"
            cy="0"
            r="15"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            className="animate-ping"
            style={{ animationDuration: '1.2s' }}
          />
          {/* Center lock dot */}
          <circle cx="0" cy="0" r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />

          {/* Target Label pill */}
          {targetName && (
            <g transform="translate(0, 32)">
              <rect
                x="-42"
                y="-10"
                width="84"
                height="20"
                rx="10"
                fill="#000000"
                fillOpacity="0.85"
                stroke="#facc15"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#facc15"
                fontSize="9"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                {targetName}
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
};
