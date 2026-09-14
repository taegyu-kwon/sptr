/** ISO 날짜(YYYY-MM-DD...)를 YYYY.MM.DD 표기로 변환 */
export const fmtDate = (iso: string) => iso.slice(0, 10).split("-").join(".");
