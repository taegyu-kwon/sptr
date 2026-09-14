import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";

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
    <div className="auth-wrap">
      <div className="auth-card">
        <div>
          <div className="brand-name" style={{ fontSize: 22, letterSpacing: 4 }}>SPTR</div>
          <div className="muted small" style={{ marginTop: 2 }}>계약된 팀 전용 유소년 야구 성장 관리 플랫폼</div>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(null); }}>
            로그인
          </button>
          <button className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setError(null); }}>
            회원가입
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <>
              <div className="field">
                <label>이름</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="실명 입력" required />
              </div>
              <div className="field">
                <label>본인인증</label>
                {verified ? (
                  <div className="ok-box">본인인증이 완료되었습니다.</div>
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
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="btn" type="submit">
            {mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>

        <div className="demo-hint">
          <b>데모 계정</b> (클릭하면 자동 입력, 비밀번호 demo1234)
          <br />
          선수/학부모: <code onClick={() => fill("player@sptr.demo")}>player@sptr.demo</code>
          {"  "}코칭스태프: <code onClick={() => fill("coach@sptr.demo")}>coach@sptr.demo</code>
          <br />
          <b>데모 가입 코드</b>: <code onClick={() => setCode("SPTR-PLAYER-01")}>SPTR-PLAYER-01</code>{" "}
          <code onClick={() => setCode("SPTR-PLAYER-02")}>SPTR-PLAYER-02</code>{" "}
          <code onClick={() => setCode("SPTR-COACH-01")}>SPTR-COACH-01</code>
          <br />
          <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={resetDemo}>
            데모 데이터 초기화
          </span>
        </div>
      </div>
    </div>
  );
}
