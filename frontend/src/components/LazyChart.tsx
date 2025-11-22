import React, { useEffect, useRef, useState } from 'react';
import { LoadingSkeleton } from './LoadingSkeleton';

interface LazyChartProps {
  children: React.ReactNode;
  height?: string;
  threshold?: number;
}

/**
 * Lazy loading wrapper for charts
 * Only renders chart content when it's visible in the viewport
 */
export const LazyChart: React.FC<LazyChartProps> = ({
  children,
  height = '400px',
  threshold = 0.1,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true);
            setHasLoaded(true);
          }
        });
      },
      {
        threshold,
        rootMargin: '50px', // Start loading slightly before visible
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [threshold, hasLoaded]);

  return (
    <div ref={containerRef} style={{ minHeight: height }}>
      {isVisible ? (
        children
      ) : (
        <LoadingSkeleton variant="chart" height={height} />
      )}
    </div>
  );
};
