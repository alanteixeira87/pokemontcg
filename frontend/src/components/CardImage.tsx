import { useEffect, useRef, useState } from "react";
import { cardThumbnailUrl, handleCardImageError } from "../lib/cardImage";

type CardImageProps = {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  eager?: boolean;
};

export function CardImage({ src, alt, width, height, className = "", eager = false }: CardImageProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (eager || shouldLoad) return;
    const element = containerRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [eager, shouldLoad]);

  return (
    <span
      ref={containerRef}
      className={`relative block overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {!loaded && <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800" />}
      {shouldLoad && (
        <img
          src={cardThumbnailUrl(src)}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          decoding="async"
          width={width}
          height={height}
          onLoad={() => setLoaded(true)}
          onError={(event) => {
            handleCardImageError(event.currentTarget);
            setLoaded(true);
          }}
          className={`h-full w-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
