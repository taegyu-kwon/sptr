import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { BrandMark } from "../components/icons";
import { Notice, Seg } from "../components/ui";

export default function Auth() {
  const { login, signup, resetDemo } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goHome = () => nav("/");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      const err = login(email, password);
      if (err) setError(err);
      else goHome();
    } else {
      if (!verified) {
        setError("본인인증을 먼저 완료해주세요.");
        return;
      }
      const err = signup({ email, password, name, code });
      if (err) setError(err);
      else goHome();
    }
  };

  const fill = (em: string) => {
    setMode("login");
    setEmail(em);
    setPassword("demo1234");
  };

  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="top">
          <BrandMark />
          <span className="wordmark">SPTR</span>
        </div>
        <div>
          <h1 className="big">SPTR<i>.</i></h1>
          <p className="tag">계약된 팀 전용 유소년 야구 성장 관리 플랫폼</p>
        </div>
        <div className="foot">
          <span>© 2026 SPTR</span>
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <h2 className="auth-title">{mode === "login" ? "로그인" : "회원가입"}</h2>
          <p className="auth-sub">
            {mode === "login"
              ? "이메일과 비밀번호를 입력하세요."
              : "팀에서 받은 개별 가입 코드가 필요합니다."}
          </p>

          <form className="auth-form" onSubmit={submit}>
            <Seg
              value={mode}
              onChange={m => { setMode(m); setError(null); }}
              options={[
                { value: "login", label: "로그인" },
                { value: "signup", label: "회원가입" },
              ]}
            />

            {mode === "signup" && (
              <>
                <div className="field">
                  <label>이름</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="실명 입력" required />
                </div>
                <div className="field">
                  <label>본인인증</label>
                  {verified ? (
                    <Notice kind="ok">본인인증이 완료되었습니다.</Notice>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        if (!name.trim()) {
                          setError("이름을 먼저 입력해주세요.");
                          return;
                        }
                        setError(null);
                        setVerified(true);
                      }}
                    >
                      휴대폰 본인인증 (데모: 클릭 시 완료)
                    </button>
                  )}
                </div>
                <div className="field">
                  <label>개별 가입 코드</label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="팀에 제공된 코드 입력 (예: SPTR-PLAYER-01)"
                    required
                  />
                </div>
              </>
            )}
            <div className="field">
              <label>이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="field">
              <label>비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>

            {error && <Notice kind="error">{error}</Notice>}

            <button className="btn lg block" type="submit">
              {mode === "login" ? "로그인" : "가입하기"}
            </button>
          </form>

          <div className="auth-demo">
            <div><b className="strong">데모 계정</b> · 클릭하면 자동 입력 (비밀번호 demo1234)</div>
            <div className="row">
              <span className="lbl">선수/학부모</span>
              <button type="button" className="chip" onClick={() => fill("player@sptr.demo")}>player@sptr.demo</button>
            </div>
            <div className="row">
              <span className="lbl">코칭스태프</span>
              <button type="button" className="chip" onClick={() => fill("coach@sptr.demo")}>coach@sptr.demo</button>
            </div>
            <div className="row">
              <span className="lbl">가입 코드</span>
              {["SPTR-PLAYER-01", "SPTR-PLAYER-02", "SPTR-COACH-01"].map(c => (
                <button type="button" className="chip" key={c} onClick={() => { setMode("signup"); setCode(c); }}>{c}</button>
              ))}
            </div>
          </div>
          <div className="auth-foot">
            <button type="button" className="link-btn" onClick={resetDemo}>데모 데이터 초기화</button>
          </div>
        </div>
      </div>
    </div>
  );
}
