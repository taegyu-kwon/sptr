import React, { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { BrandMark } from "../components/icons";
import { Notice, Seg } from "../components/ui";
import type { PeekResult } from "../lib/remote";
import "../styles/team.css";
import "../styles/server.css";

type Tab = "login" | "signup" | "team";

/** 가입 코드가 누구의 어떤 계정인지 안내 */
function guideOf(info: PeekResult): string {
  const team = info.team_name ? `${info.team_name} ` : "";
  if (info.role === "coach") return `${team}코칭스태프 계정으로 가입합니다.`;
  if (info.relation === "parent") return `${team}${info.player_name ?? ""} 선수의 학부모 계정으로 가입합니다. 선수 화면을 보기 전용으로 사용합니다.`;
  return `${team}${info.player_name ?? ""} 선수 계정으로 가입합니다.`;
}

/** 입력한 가입 코드를 서버에 확인한다(형식이 갖춰졌을 때만, 입력이 멈춘 뒤) */
function useCodeInfo(code: string, active: boolean) {
  const { peekCode } = useStore();
  const [res, setRes] = useState<{ code: string; error: string | null; info?: PeekResult } | null>(null);
  const key = code.trim().toUpperCase();
  useEffect(() => {
    if (!active || key.length < 6) return;
    let stale = false;
    const timer = window.setTimeout(async () => {
      const r = await peekCode(key);
      if (!stale) setRes({ code: key, ...r });
    }, 350);
    return () => { stale = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);
  return active && res && res.code === key && key.length >= 6 ? res : null;
}

export default function Auth() {
  const { status, authEmail, enterDemo, serverLogin, serverSignup, startTeam, redeemCode, createMyTeam, finishNewTeam, logout, resetDemo } = useStore();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);

  /** 로그인은 됐지만 팀이 없는 계정 — 가입 코드 입력 / 새 팀 시작만 보여 준다 */
  const needProfile = status === "needProfile";
  const newTeam = status === "newTeam";
  const mode: Tab = needProfile && tab === "login" ? "signup" : tab;
  const clear = () => { setError(null); setNotice(null); setResetDone(false); };

  const codeInfo = useCodeInfo(code, mode === "signup" && !newTeam);
  const codeOk = codeInfo && !codeInfo.error && codeInfo.info ? codeInfo.info : null;
  const codeRelation = codeOk?.role === "player" ? codeOk.relation ?? "self" : null;
  /** 선수 본인 코드는 이름이 명단 이름으로 정해져 있어 이름 칸을 두지 않는다 */
  const nameFixed = codeRelation === "self";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    clear();
    setBusy(true);
    try {
      if (mode === "login") {
        const err = await serverLogin(email, password);
        if (err) setError(err);
      } else if (mode === "signup") {
        if (codeInfo?.error) return setError(codeInfo.error);
        if (needProfile) {
          const err = await redeemCode(code, name);
          if (err) setError(err);
        } else {
          const res = await serverSignup({ email, password, name, code });
          if (res.error) setError(res.error);
          else if (res.notice) { setNotice(res.notice); setTab("login"); }
        }
      } else if (needProfile) {
        const err = await createMyTeam({ name, teamName, region });
        if (err) setError(err);
      } else {
        const res = await startTeam({ email, password, name, teamName, region });
        if (res.error) setError(res.error);
        else if (res.notice) { setNotice(res.notice); setTab("login"); }
      }
    } finally {
      setBusy(false);
    }
  };

  /** 체험 모드 — 이 브라우저의 예시 데이터로 바로 들어간다(서버를 쓰지 않는다) */
  const tryDemo = (role: "coach" | "player") => {
    clear();
    const err = enterDemo(role);
    if (err) setError(`${err} 체험 계정을 처음 상태로 돌리려면 아래 '데모 데이터 초기화'를 누르세요.`);
  };

  const finish = async (withSeed: boolean) => {
    if (busy) return;
    clear();
    setBusy(true);
    setProgress(withSeed ? { label: "준비", done: 0, total: 1 } : null);
    const err = await finishNewTeam(withSeed, (label, done, total) => setProgress({ label, done, total }));
    setBusy(false);
    setProgress(null);
    if (err) setError(`${err} 다시 시도하거나 빈 팀으로 시작할 수 있습니다.`);
  };

  const title = newTeam ? "팀을 만들었습니다" : needProfile ? "팀에 가입해 주세요" : mode === "login" ? "다시 만나 반가워요." : mode === "signup" ? "팀과 함께 시작하세요" : "새 팀을 시작하세요";
  const sub = newTeam
    ? "처음에 무엇으로 시작할지 고르세요."
    : needProfile
      ? `${authEmail ?? "이 계정"}(으)로 로그인했지만 아직 팀에 가입하지 않았습니다. 가입 코드를 입력하거나 새 팀을 만드세요.`
      : mode === "login"
        ? "이메일과 비밀번호를 입력하세요."
        : mode === "signup"
          ? "코치에게 받은 가입 코드와 이메일로 가입합니다."
          : "코칭스태프가 팀을 새로 만들고, 선수·학부모는 가입 코드로 초대합니다.";

  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="top">
          <BrandMark />
          <span className="wordmark">SPTR<i>.</i></span>
        </div>
        <div>
          <h1 className="big">SPTR<i>.</i></h1>
          <p className="tag">계약된 팀 전용 유소년 야구 성장 관리 플랫폼</p>
        </div>
        <div className="foot">
          <span>© {new Date().getFullYear()} SPTR</span>
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <h2 className="auth-title">{title}</h2>
          <p className="auth-sub">{sub}</p>

          {newTeam ? (
            <div className="auth-form">
              <div className="auth-choice">
                <button type="button" className="btn" disabled={busy} onClick={() => finish(true)}>
                  <b>예시 데이터로 시작</b>
                  <small>예시 선수 24명과 측정·시합·출석·공지·일정을 넣어 둘러봅니다. 나중에 고치거나 지울 수 있습니다.</small>
                </button>
                <button type="button" className="btn outline" disabled={busy} onClick={() => finish(false)}>
                  <b>빈 팀으로 시작</b>
                  <small>선수단 화면에서 선수를 직접 등록합니다.</small>
                </button>
              </div>
              {progress && (
                <div role="status" aria-live="polite">
                  <span className="small muted">{progress.label} 올리는 중 ({Math.min(progress.done + 1, progress.total)}/{progress.total})</span>
                  <div className="auth-progress"><i style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div>
                </div>
              )}
              {error && <Notice kind="error">{error}</Notice>}
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <Seg
                value={mode}
                onChange={m => { setTab(m); clear(); }}
                options={[
                  ...(needProfile ? [] : [{ value: "login" as Tab, label: "로그인" }]),
                  { value: "signup" as Tab, label: needProfile ? "가입 코드 입력" : "회원가입" },
                  { value: "team" as Tab, label: "새 팀 시작" },
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
                    {codeOk && <Notice kind="ok">{guideOf(codeOk)}</Notice>}
                    {codeInfo?.error && <Notice kind="warn">{codeInfo.error}</Notice>}
                  </div>
                  {!nameFixed && (
                    <div className="field">
                      <label htmlFor="auth-name">{codeRelation === "parent" ? "학부모 이름" : "이름"}</label>
                      <input id="auth-name" value={name} onChange={e => setName(e.target.value)} placeholder="실명 입력" required maxLength={20} autoComplete="name" />
                    </div>
                  )}
                </>
              )}
              {mode === "team" && (
                <>
                  <div className="field">
                    <label htmlFor="auth-name">이름 (감독·코치)</label>
                    <input id="auth-name" value={name} onChange={e => setName(e.target.value)} placeholder="예: 김감독" required maxLength={20} autoComplete="name" />
                  </div>
                  <div className="field">
                    <label htmlFor="auth-team">팀 이름</label>
                    <input id="auth-team" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="예: 배명중학교 야구부" required maxLength={30} />
                  </div>
                  <div className="field">
                    <label htmlFor="auth-region">지역</label>
                    <input id="auth-region" value={region} onChange={e => setRegion(e.target.value)} placeholder="예: 서울 송파구" maxLength={30} />
                  </div>
                </>
              )}
              {!needProfile && (
                <>
                  <div className="field">
                    <label htmlFor="auth-email">이메일</label>
                    <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="auth-password">비밀번호</label>
                    <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required minLength={mode === "login" ? undefined : 6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  </div>
                </>
              )}

              {notice && <Notice kind="ok">{notice}</Notice>}
              {error && <Notice kind="error">{error}</Notice>}

              <button className="btn lg block" type="submit" disabled={busy}>
                {busy ? "처리하는 중" : mode === "login" ? "로그인" : mode === "signup" ? (needProfile ? "코드로 가입하기" : "가입하기") : "팀 만들기"}
              </button>
              {needProfile && (
                <div className="auth-switch">
                  <span>다른 계정으로 로그인하려면</span>
                  <button type="button" className="link-btn" onClick={() => { clear(); setTab("login"); logout(); }}>로그아웃</button>
                </div>
              )}
            </form>
          )}

          {!newTeam && (
            <>
              <div className="auth-demo">
                <div><b className="strong">체험하기</b> <span className="auth-try-note">· 가입 없이 예시 팀 데이터로 둘러봅니다(이 브라우저에만 저장)</span></div>
                <div className="auth-try">
                  <button type="button" className="btn outline" onClick={() => tryDemo("coach")}>코치로 체험하기</button>
                  <button type="button" className="btn outline" onClick={() => tryDemo("player")}>선수로 체험하기</button>
                </div>
              </div>
              <div className="auth-foot">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    resetDemo();
                    clear();
                    setResetDone(true);
                  }}
                >
                  데모 데이터 초기화
                </button>
              </div>
              {resetDone && <Notice kind="ok" className="mt12">체험 모드의 예시 데이터를 처음 상태로 되돌렸습니다.</Notice>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
