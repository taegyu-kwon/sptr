import React from "react";

/* 선 아이콘 모음. 24x24 기준, stroke 1.75. 크기는 CSS(svg width/height)로 맞춘다. */
type P = React.SVGProps<SVGSVGElement>;

function I({ children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Search: (p: P) => (
    <I {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></I>
  ),
  Menu: (p: P) => (
    <I {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></I>
  ),
  X: (p: P) => (
    <I {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></I>
  ),
  LogOut: (p: P) => (
    <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></I>
  ),
  ArrowLeft: (p: P) => (
    <I {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></I>
  ),
  ChevronRight: (p: P) => (
    <I {...p}><path d="m9 18 6-6-6-6" /></I>
  ),
  ChevronUp: (p: P) => (
    <I {...p}><path d="m18 15-6-6-6 6" /></I>
  ),
  ChevronDown: (p: P) => (
    <I {...p}><path d="m6 9 6 6 6-6" /></I>
  ),
  Check: (p: P) => (
    <I {...p}><path d="M20 6 9 17l-5-5" /></I>
  ),
  Plus: (p: P) => (
    <I {...p}><path d="M5 12h14" /><path d="M12 5v14" /></I>
  ),
  Trash: (p: P) => (
    <I {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></I>
  ),
  Info: (p: P) => (
    <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></I>
  ),
  Alert: (p: P) => (
    <I {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></I>
  ),
  Shield: (p: P) => (
    <I {...p}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></I>
  ),
  Refresh: (p: P) => (
    <I {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></I>
  ),
  Target: (p: P) => (
    <I {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></I>
  ),
  Sparkline: (p: P) => (
    <I {...p}><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></I>
  ),

  /* 내비게이션 */
  Gauge: (p: P) => (
    <I {...p}><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></I>
  ),
  PenLine: (p: P) => (
    <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></I>
  ),
  Calculator: (p: P) => (
    <I {...p}><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M8 6h8" /><path d="M16 14v4" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></I>
  ),
  TrendingUp: (p: P) => (
    <I {...p}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></I>
  ),
  Trophy: (p: P) => (
    <I {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></I>
  ),
  Message: (p: P) => (
    <I {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></I>
  ),
  Calendar: (p: P) => (
    <I {...p}><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></I>
  ),
  Users: (p: P) => (
    <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></I>
  ),
  ListOrdered: (p: P) => (
    <I {...p}><path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></I>
  ),
  Grid: (p: P) => (
    <I {...p}><rect width="7" height="7" x="3" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="14" rx="1.5" /><rect width="7" height="7" x="3" y="14" rx="1.5" /></I>
  ),
  Clipboard: (p: P) => (
    <I {...p}><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></I>
  ),
  MapPin: (p: P) => (
    <I {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></I>
  ),
  Timer: (p: P) => (
    <I {...p}><path d="M10 2h4" /><path d="M12 14v-4" /><circle cx="12" cy="14" r="8" /></I>
  ),
};

/* 브랜드 마크 — 브랜드색 사각형 안의 다이아몬드(내야) */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="var(--brand)" />
      <path d="M14 6.5 21.5 14 14 21.5 6.5 14Z" fill="none" stroke="var(--brand-ink)" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="2.1" fill="var(--brand-ink)" />
    </svg>
  );
}
