import React, { useState } from "react";
import { useStore } from "../lib/store";
import { Avatar, Notice, PageHead } from "../components/ui";
import "../styles/team.css";

type Msg = { kind: "ok" | "error"; text: string } | null;

/** 내 계정 — 이름 수정·비밀번호 변경(선수·학부모·코치 공통) */
export default function AccountPage() {
  const { db, user, updateAccount, changePassword } = useStore();
  const me = user!;
  const team = db.teams.find(t => t.id === me.teamId);
  const player = me.playerId ? db.players.find(p => p.id === me.playerId) : null;
  const isParent = me.relation === "parent";
  /** 선수 본인 이름은 명단 이름과 같아야 해서 코치가 고친다 */
  const nameLocked = me.role === "player" && !isParent;
  const roleLabel = me.role === "coach" ? "코칭스태프" : isParent ? `${player?.name ?? ""} 선수 학부모` : "선수";

  const [name, setName] = useState(me.name);
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const err = updateAccount({ name });
    if (err) return setNameMsg({ kind: "error", text: err });
    setName(name.trim());
    setNameMsg({ kind: "ok", text: "이름을 저장했습니다." });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return setPwMsg({ kind: "error", text: "현재 비밀번호를 입력하세요." });
    if (next.length < 6) return setPwMsg({ kind: "error", text: "새 비밀번호는 6자 이상이어야 합니다." });
    if (next !== confirm) return setPwMsg({ kind: "error", text: "새 비밀번호와 확인이 서로 다릅니다." });
    const err = changePassword(current, next);
    if (err) return setPwMsg({ kind: "error", text: err });
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwMsg({ kind: "ok", text: "비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용하세요." });
  };

  return (
    <div className="account-page">
      <PageHead title="내 계정" desc="이름과 비밀번호를 관리합니다." />

      <div className="panel">
        <div className="account-id">
          <Avatar name={me.name} size="lg" />
          <div>
            <b>{me.name}</b>
            <span>{roleLabel} · {team?.name ?? "팀 미지정"}</span>
          </div>
        </div>
        <form onSubmit={saveName}>
          <div className="form-grid cols-2">
            <div className="field">
              <label htmlFor="account-email">이메일 (로그인 아이디)</label>
              <input id="account-email" value={me.email} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="account-name">이름</label>
              <input
                id="account-name"
                value={name}
                onChange={e => { setName(e.target.value); setNameMsg(null); }}
                disabled={nameLocked}
                maxLength={20}
              />
              {nameLocked && <span className="help">선수 이름은 명단과 같아야 해서 코치가 선수단 화면에서 수정합니다.</span>}
            </div>
          </div>
          {nameMsg && <Notice kind={nameMsg.kind} className="mt12">{nameMsg.text}</Notice>}
          {!nameLocked && (
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit" disabled={!name.trim() || name.trim() === me.name}>이름 저장</button>
            </div>
          )}
        </form>
      </div>

      <div className="panel">
        <div className="card-head">
          <h3>비밀번호 변경</h3>
          <span className="meta">6자 이상</span>
        </div>
        <form onSubmit={savePassword}>
          <div className="form-grid cols-1">
            <div className="field">
              <label htmlFor="account-pw-current">현재 비밀번호</label>
              <input id="account-pw-current" type="password" value={current} onChange={e => { setCurrent(e.target.value); setPwMsg(null); }} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="account-pw-next">새 비밀번호</label>
              <input id="account-pw-next" type="password" value={next} onChange={e => { setNext(e.target.value); setPwMsg(null); }} placeholder="6자 이상" autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="account-pw-confirm">새 비밀번호 확인</label>
              <input id="account-pw-confirm" type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setPwMsg(null); }} autoComplete="new-password" />
            </div>
          </div>
          {pwMsg && <Notice kind={pwMsg.kind} className="mt12">{pwMsg.text}</Notice>}
          <div className="flex gap12 wrap mt16">
            <button className="btn" type="submit">비밀번호 변경</button>
          </div>
        </form>
      </div>
    </div>
  );
}
