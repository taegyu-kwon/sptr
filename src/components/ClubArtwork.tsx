import React from "react";

/** Decorative baseball field, drawn as vector geometry so it stays crisp at every size. */
export function FieldArtwork({ className = "" }: { className?: string }) {
  return <svg className={`club-field-art ${className}`} viewBox="0 0 440 330" fill="none" aria-hidden="true">
    <path d="M220 294 42 116Q220-53 398 116Z" fill="#346b61" />
    <path d="M220 294 70 144Q220-5 370 144Z" fill="#3c796b" />
    <path d="M220 294 100 174Q220 54 340 174Z" fill="#438273" />
    <path d="M220 294 129 203Q220 112 311 203Z" fill="#4c8b79" />
    <path d="m220 294-91-91 91-91 91 91Z" fill="#d6aa7d" />
    <path d="m220 266-63-63 63-63 63 63Z" fill="#346b61" />
    <path d="M220 294 25 99M220 294 415 99" stroke="#eff4de" strokeWidth="1.5" opacity=".7" />
    <path d="m220 294-91-91 91-91 91 91Z" stroke="#f8f2dd" strokeWidth="1.5" />
    <circle cx="220" cy="206" r="12" fill="#d6aa7d" />
    <path d="M214 206h12" stroke="#fff8e8" strokeWidth="3" />
    <path d="m220 286 5 4v5h-10v-5Z" fill="#fff8e8" />
    {[ [129,203], [220,112], [311,203] ].map(([x,y]) => <rect key={x} x={x-4} y={y-4} width="8" height="8" fill="#fff8e8" transform={`rotate(45 ${x} ${y})`} />)}
    <path d="M63 94Q220-28 377 94" stroke="#a3c2b3" strokeDasharray="3 5" opacity=".6" />
    <circle cx="220" cy="55" r="4" fill="#d7eab4" /><circle cx="113" cy="103" r="4" fill="#d7eab4" /><circle cx="327" cy="103" r="4" fill="#d7eab4" />
    <circle cx="164" cy="161" r="4" fill="#d7eab4" /><circle cx="276" cy="161" r="4" fill="#d7eab4" />
    <text x="220" y="325" textAnchor="middle" fill="#bdd3c9" fontSize="9" letterSpacing="3">THE NEXT INNING STARTS HERE</text>
  </svg>;
}

export function JerseyArtwork({ number, tone = "blue" }: { number: number; tone?: string }) {
  return <svg className={`jersey-art ${tone}`} viewBox="0 0 180 160" aria-hidden="true">
    <ellipse cx="90" cy="146" rx="45" ry="5" fill="currentColor" opacity=".08" />
    <path d="m63 18-22 9-29 35 25 20 15-17v75h76V65l15 17 25-20-29-35-22-9c-8 13-46 13-54 0Z" fill="var(--jersey-fill, #f7f9ff)" stroke="currentColor" strokeWidth="1.5" />
    <path d="m63 18 12 18h30l12-18M90 36v104M51 32v33M129 32v33" fill="none" stroke="currentColor" opacity=".3" />
    <path d="m18 55 25 20m94 0 25-20" stroke="currentColor" strokeWidth="6" opacity=".7" />
    <path d="M57 133h66" stroke="currentColor" strokeWidth="3" opacity=".5" />
    <text x="90" y="60" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="3" fill="currentColor">SPTR</text>
    <text x="90" y="114" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="800" letterSpacing="-3" fill="currentColor">{String(number).padStart(2, "0")}</text>
  </svg>;
}
