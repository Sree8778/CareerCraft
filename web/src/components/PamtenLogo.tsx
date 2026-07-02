import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  mode?: string;
  width?: number;
  height?: number;
}

export default function AppLogo({ className = '', width = 80, height = 40 }: AppLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 80 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect width="80" height="40" rx="8" fill="url(#ccGrad)" />
      <text
        x="40"
        y="27"
        textAnchor="middle"
        fill="white"
        fontSize="15"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="-0.5"
      >
        CC
      </text>
      <defs>
        <linearGradient id="ccGrad" x1="0" y1="0" x2="80" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}
