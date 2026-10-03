/** ISO 날짜(YYYY-MM-DD...)를 YYYY.MM.DD 표기로 변환 */
export const fmtDate = (iso: string) => iso.slice(0, 10).split("-").join(".");

/** 소수 1자리 반올림 */
export const r1 = (v: number) => Math.round(v * 10) / 10;
