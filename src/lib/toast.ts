/* 전역 토스트 — 서버 저장 실패 같은 알림을 화면 아래에 잠깐 띄운다. 표시는 components/Toast.tsx */
export type ToastKind = "error" | "ok" | "info";
export interface ToastItem { id: number; kind: ToastKind; text: string }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export const getToasts = () => items;

export function dismissToast(id: number) {
  items = items.filter(t => t.id !== id);
  emit();
}

export function toast(text: string, kind: ToastKind = "error") {
  // 같은 문구가 이미 떠 있으면 다시 띄우지 않는다(반복 실패로 화면이 뒤덮이지 않게)
  if (items.some(t => t.text === text)) return;
  const id = nextId++;
  items = [...items.slice(-2), { id, kind, text }];
  emit();
  window.setTimeout(() => dismissToast(id), kind === "error" ? 7000 : 3500);
}
