import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: CSSProperties;
}

/** Single shimmer block */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** A few lines like a text block */
export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '65%' : '100%'} height={13} />
      ))}
    </div>
  );
}

/** Mimics a .list-item row */
export function SkeletonListItem() {
  return (
    <div className="skeleton-row">
      <Skeleton width={40} height={40} radius={10} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="38%" height={11} />
      </div>
      <Skeleton width={52} height={13} />
    </div>
  );
}

/** Mimics a stat/KPI card */
export function SkeletonStatCard() {
  return (
    <div className="skeleton-card" style={{ padding: 'var(--sp-md)' }}>
      <Skeleton width="40%" height={11} style={{ marginBottom: 10 }} />
      <Skeleton width="60%" height={26} />
    </div>
  );
}
