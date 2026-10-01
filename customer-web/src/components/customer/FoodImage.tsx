import { useEffect, useState } from 'react';
import { FOOD_IMAGE_DEFAULT } from '../../lib/productImages';

type Props = {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
};

export function FoodImage({ src, alt, className, fallback = FOOD_IMAGE_DEFAULT }: Props) {
  const [activeSrc, setActiveSrc] = useState(src);

  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (activeSrc !== fallback) {
          setActiveSrc(fallback);
        }
      }}
    />
  );
}
