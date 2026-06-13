import React from 'react';

interface PamtenLogoProps {
  className?: string;
  size?: number; // standard bounding size
  mode?: 'header' | 'popup' | 'meta' | 'png';
  width?: number;
  height?: number;
}

export default function PamtenLogo({ 
  className = '', 
  size, 
  mode = 'png',
  width,
  height
}: PamtenLogoProps) {
  const src = mode === 'header' 
    ? '/pamten_logo_header.webp' 
    : mode === 'meta' 
    ? '/pamten_logo_meta.webp' 
    : mode === 'popup' 
    ? '/pamten_logo_popup.webp'
    : '/pamten_logo_popup_png.png';
  
  // Real logo aspect ratio is roughly 2:1 (e.g. 168x82 or 322x157)
  // If width is specified, use it. If size is specified, use size for width, and size/2 for height.
  const displayWidth = width || size || 80;
  const displayHeight = height || (size ? size / 2 : 40);

  return (
    <img
      src={src}
      alt="PamTen Logo"
      className={className}
      width={displayWidth}
      height={displayHeight}
      style={{ objectFit: 'contain' }}
    />
  );
}
