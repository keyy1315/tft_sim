'use client';
import { useState } from 'react';
import Image from 'next/image';
import { getAugmentImage } from '@/data/imageMap';

export const AUGMENT_FALLBACK_ICON_PATH = 'ASSETS/Maps/TFT/Icons/Augments/Hexcore/Missing-T2.tex';
const FALLBACK_URL = getAugmentImage(AUGMENT_FALLBACK_ICON_PATH);

interface Props {
  icon: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * 증강 아이콘 렌더러. 원본 icon 로드 실패 시 Missing-T2 플레이스홀더로 fallback.
 * (로컬 JSON의 icon 경로가 CDragon 규격과 다르거나 riot 에셋이 제거된 경우 대비)
 */
export default function AugmentIcon({ icon, alt, width, height, className = '' }: Props) {
  const [broken, setBroken] = useState(false);
  const src = broken ? FALLBACK_URL : getAugmentImage(icon);
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      onError={() => { if (!broken) setBroken(true); }}
      unoptimized
    />
  );
}
