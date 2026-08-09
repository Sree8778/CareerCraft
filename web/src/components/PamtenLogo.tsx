import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  mode?: string;
  width?: number;
  height?: number;
}

export default function AppLogo({ className = '', width = 80, height = 40 }: AppLogoProps) {
  // The supplied PNG is 216 × 123, while the visible lock-up sits within
  // x:25–198 and y:53–96. Position the image from that visible area instead
  // of centring its padded canvas, so the mark stays optically centred at
  // every size (navbar, footer, and compact loading state).
  const crop = { canvasWidth: 216, canvasHeight: 123, left: 25, top: 53, width: 174, height: 44 };
  const padding = 4;
  const scale = Math.min(
    Math.max(0, width - padding * 2) / crop.width,
    Math.max(0, height - padding) / crop.height,
  );
  const imageWidth = crop.canvasWidth * scale;
  const imageHeight = crop.canvasHeight * scale;
  const imageLeft = (width - crop.width * scale) / 2 - crop.left * scale;
  const imageTop = (height - crop.height * scale) / 2 - crop.top * scale;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white transition-colors dark:bg-[#0b1124] ${className}`}
      style={{ width, height }}
    >
      <img
        src="/careercraft-logo.png"
        alt="CareerCraft"
        width={width}
        height={height}
        className="absolute max-w-none dark:hidden"
        style={{ width: imageWidth, height: imageHeight, left: imageLeft, top: imageTop }}
      />
      <img
        src="/careercraft-logo-dark.png"
        alt=""
        aria-hidden="true"
        className="absolute hidden object-contain dark:block"
        style={{ width: Math.max(0, width - padding * 2), height: Math.max(0, height - padding * 2) }}
      />
    </span>
  );
}
