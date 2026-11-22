import React, { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts } from "../lib/toast";
import "../styles/server.css";

/** 전역 토스트 — 서버 저장 실패 등을 화면 아래에 잠깐 띄운다 */
export function Toasts() {
  const items = useSyncExternalStore(subscribeToasts, getToasts);
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="assertive">
      {items.map(t => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <span>{t.text}</span>
          <button type="button" aria-label="알림 닫기" onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/** 저장된 로그인 확인·팀 데이터 읽는 동안의 화면 */
export function Splash({ text }: { text: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="splash-dot" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
