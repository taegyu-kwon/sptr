import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { BrandMark } from "../components/icons";
import { FieldArtwork } from "../components/ClubArtwork";
import { Notice, Seg } from "../components/ui";
import { relationOf } from "../lib/codes";
import "../styles/team.css";

export default function Auth() {
  const { login, signup, resetDemo, checkCode } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const goHome = () => nav("/");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetDone(false);
    if (mode === "login") {
      const err = login(email, password);
      if (err) setError(err);
      else goHome();
    } else {
      if (codeInfo?.error) {
        setError(codeInfo.error);
        return;
      }
      const err = signup({ email, password, name, code });
      if (err) setError(err);
      else goHome();
    }
  };

  /** 체험 계정으로 바로 로그인 */
  const tryDemo = (em: string) => {
    setResetDone(false);
    const err = login(em, "demo1234");
    if (err) setError(`${err} 체험 계정을 처음 상태로 돌리려면 아래 '데모 데이터 초기화'를 누르세요.`);
    else goHome();
  };

  /** 입력한 가입 코드가 누구의 어떤 계정인지 — 형식이 갖춰졌을 때만 안내한다 */
  const codeInfo = mode === "signup" && code.trim().length >= 6 ? checkCode(code) : null;
  const codeOk = codeInfo && !codeInfo.error && codeInfo.code ? codeInfo.code : null;
  const codeRelation = codeOk?.role === "player" ? relationOf(codeOk) : null;
  /** 선수 본인 코드는 이름이 명단 이름으로 정해져 있어 이름 칸을 두지 않는다 */
  const nameFixed = codeRelation === "self";
  const codeGuide = !codeOk
    ? null
    : codeOk.role === "coach"
      ? "코칭스태프 계정으로 가입합니다."
      : codeRelation === "parent"
        ? `${codeInfo!.player!.name} 선수의 학부모 계정으로 가입합니다. 선수 화면을 보기 전용으로 사용합니다.`
        : `${codeInfo!.player!.name} 선수 계정으로 가입합니다.`;

  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="top">
          <BrandMark />
          <span className="wordmark">sptr<i>.</i></span><span className="auth-edition">THE CLUBHOUSE</span>
        </div>
        <div className="auth-story">
          <span className="auth-eyebrow">FOR THE LOVE OF THE GAME</span>
          <h1 className="auth-headline">GREAT TEAMS.<br /><em>START HERE.</em></h1>
          <p className="auth-caption">좋은 팀의 시작, 함께 성장하는 매일.</p>
          <p className="auth-description">선수의 가능성을 발견하고, 팀의 다음 경기를 준비하는 곳.<br />당신의 야구를 위한 하나의 클럽하우스.</p>
          <FieldArtwork />
        </div>
        <div className="foot">
          <span>BASEBALL, BETTER TOGETHER.</span><span>© {new Date().getFullYear()} SPTR</span>
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <span className="auth-eyebrow">WELCOME TO YOUR CLUBHOUSE</span>
          <h2 className="auth-title">{mode === "login" ? "다시 만나 반가워요." : "팀과 함께 시작하세요"}</h2>
          <p className="auth-sub">
            {mode === "login"
              ? "이메일과 비밀번호를 입력하세요."
              : "코치에게 받은 가입 코드와 이메일로 가입합니다."}
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
                  <label htmlFor="auth-code">가입 코드</label>
                  <input
                    id="auth-code"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); }}
                    placeholder="코치에게 받은 코드 (예: SPTR-AB12-CD34)"
                    autoComplete="off"
                    required
                  />
                  {codeGuide && <Notice kind="ok">{codeGuide}</Notice>}
                  {codeInfo?.error && <Notice kind="warn">{codeInfo.error}</Notice>}
                </div>
                {!nameFixed && (
                  <div className="field">
                    <label htmlFor="auth-name">{codeRelation === "parent" ? "학부모 이름" : "이름"}</label>
                    <input id="auth-name" value={name} onChange={e => setName(e.target.value)} placeholder="실명 입력" required autoComplete="name" />
                  </div>
                )}
              </>
            )}
            <div className="field">
              <label htmlFor="auth-email">이메일</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="auth-password">비밀번호</label>
              <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>

            {error && <Notice kind="error">{error}</Notice>}

            <button className="btn lg block" type="submit">
              {mode === "login" ? "로그인" : "가입하기"}
            </button>
          </form>

          <div className="auth-demo">
            <div><b className="strong">체험하기</b> <span className="auth-try-note">· 예시 팀 데이터로 바로 둘러볼 수 있습니다</span></div>
            <div className="auth-try">
              <button type="button" className="btn outline" onClick={() => tryDemo("coach@sptr.demo")}>코치로 체험하기</button>
              <button type="button" className="btn outline" onClick={() => tryDemo("player@sptr.demo")}>선수로 체험하기</button>
            </div>
            {mode === "signup" && (
              <div className="auth-codes">
                <span className="auth-try-note">체험용 가입 코드</span>
                {["SPTR-PLAYER-01", "SPTR-COACH-01"].map(c => (
                  <button type="button" className="chip" key={c} onClick={() => { setCode(c); setError(null); }}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <div className="auth-foot">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                resetDemo();
                setError(null);
                setResetDone(true);
              }}
            >
              데모 데이터 초기화
            </button>
          </div>
          {resetDone && <Notice kind="ok" className="mt12">데모 데이터를 처음 상태로 되돌렸습니다.</Notice>}
        </div>
      </div>
    </div>
  );
}
