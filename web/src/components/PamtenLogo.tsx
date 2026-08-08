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
    <img
      src="/careercraft-logo.png"
      alt="CareerCraft"
      width={width}
      height={height}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain' }}
    />
  );
}
