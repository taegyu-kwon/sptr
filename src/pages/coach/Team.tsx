import React, { useState } from "react";
import { useStore } from "../../lib/store";
import { accountOfPlayer, codeState, codesOfPlayer, CODE_VALID_DAYS } from "../../lib/codes";
import { daysBetween, todayISO } from "../../lib/schedule";
import { playerPositionDetail } from "../../lib/roster";
import type { Player, SignupCode } from "../../lib/types";
import { Avatar, Empty, Notice, PageHead } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/coach.css";
import "../../styles/team.css";

type Relation = "self" | "parent";
const REL_LABEL: Record<Relation, string> = { self: "본인", parent: "학부모" };

/** 만료일 안내 — "2026-12-05까지 (14일 남음)" */
function expiryText(c: SignupCode, today: string): string {
  if (!c.expiresAt) return "만료일 없음 (예시 코드)";
  const left = daysBetween(today, c.expiresAt);
  return `${c.expiresAt}까지 (${left === 0 ? "오늘 만료" : `${left}일 남음`})`;
}

export default function TeamPage() {
  const { db, user, updateTeam, issueCode, revokeCode } = useStore();
  const teamId = user!.teamId;
  const team = db.teams.find(t => t.id === teamId);
  const today = todayISO();

  const [name, setName] = useState(team?.name ?? "");
  const [region, setRegion] = useState(team?.region ?? "");
  const [teamMsg, setTeamMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /** 방금 발급한 코드 — 옮겨 적을 수 있게 강조한다 */
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const coaches = db.users.filter(u => u.teamId === teamId && u.role === "coach");
  const coachCodes = db.codes.filter(c => c.teamId === teamId && c.role === "coach" && !c.used && !c.revoked);
  const players = db.players
    .filter(p => p.teamId === teamId)
    .sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber);

  const saveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    const n = name.trim();
    const r = region.trim();
    if (!n) return setTeamMsg({ kind: "error", text: "팀 이름을 입력하세요." });
    if (n.length > 30) return setTeamMsg({ kind: "error", text: "팀 이름은 30자 이내로 입력하세요." });
    if (!r) return setTeamMsg({ kind: "error", text: "지역을 입력하세요." });
    updateTeam(team.id, { name: n, region: r });
    setName(n);
    setRegion(r);
    setTeamMsg({ kind: "ok", text: "팀 정보를 저장했습니다. 왼쪽 메뉴의 팀 이름에 바로 반영됩니다." });
  };
  const teamDirty = !!team && (name.trim() !== team.name || region.trim() !== team.region);

  const issue = (args: Parameters<typeof issueCode>[0]) => {
    const res = issueCode(args);
    setCodeError(res.error ?? null);
    if (res.code) setFresh(res.code);
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(c => (c === code ? null : c)), 1800);
    } catch {
      setCodeError("이 브라우저에서는 복사할 수 없습니다. 코드를 직접 옮겨 적어 주세요.");
    }
  };

  const copyBtn = (code: string) => (
    <button type="button" className="link-btn" onClick={() => copy(code)} aria-label={`${code} 복사`}>
      {copied === code ? "복사됨" : "복사"}
    </button>
  );

  /** 선수 한 명의 본인/학부모 칸: 가입 완료 → 계정, 아니면 코드 상태와 발급·재발급 */
  const codeCell = (p: Player, relation: Relation) => {
    const account = accountOfPlayer(db.users, p.id, relation);
    if (account) {
      return (
        <div className="code-cell">
          <span className="pill good">가입 완료</span>
          <span className="team-code-meta">{account.email}</span>
        </div>
      );
    }
    const live = codesOfPlayer(db.codes, p, relation).filter(c => !c.used && !c.revoked);
    const c = live.find(x => codeState(x, today) === "사용 가능") ?? live[0];
    const args = { teamId, role: "player" as const, playerId: p.id, relation };
    if (!c) {
      return (
        <div className="code-cell">
          <span className="team-code-meta">코드 없음</span>
          <button type="button" className="btn outline sm" onClick={() => issue(args)} aria-label={`${p.name} ${REL_LABEL[relation]} 코드 발급`}>
            <Icon.Plus /> 발급
          </button>
        </div>
      );
    }
    const expired = codeState(c, today) === "만료";
    return (
      <div className="code-cell">
        <div className="line">
          <span className={`team-code${expired ? " off" : ""}`}>{c.code}</span>
          {expired ? <span className="pill warn">만료됨</span> : copyBtn(c.code)}
        </div>
        <span className={`team-code-meta${expired ? " warn" : ""}`}>
          {expired ? `${c.expiresAt} 만료 · 미가입` : `미가입 · ${expiryText(c, today)}`}
        </span>
        <button type="button" className="btn outline sm" onClick={() => issue(args)} aria-label={`${p.name} ${REL_LABEL[relation]} 코드 재발급`}>
          <Icon.Refresh /> 재발급
        </button>
      </div>
    );
  };

  const joined = (relation: Relation) => players.filter(p => accountOfPlayer(db.users, p.id, relation)).length;
  const isFreshRow = (p: Player) =>
    !!fresh && db.codes.some(c => c.code === fresh && (c.playerId ? c.playerId === p.id : c.playerName === p.name));

  return (
    <div className="team-page">
      <PageHead
        title="팀 관리"
        desc="팀 정보와 코치진, 선수·학부모 가입 코드를 관리합니다."
      />

      <div className="panel">
        <div className="card-head">
          <h3>팀 정보</h3>
          <span className="meta">저장하면 메뉴 상단 팀 이름에 바로 반영됩니다</span>
        </div>
        {team ? (
          <form className="team-form" onSubmit={saveTeam}>
            <div className="form-grid cols-2">
              <div className="field">
                <label htmlFor="team-name">팀 이름</label>
                <input id="team-name" value={name} onChange={e => { setName(e.target.value); setTeamMsg(null); }} maxLength={30} />
              </div>
              <div className="field">
                <label htmlFor="team-region">지역</label>
                <input id="team-region" value={region} onChange={e => { setRegion(e.target.value); setTeamMsg(null); }} maxLength={30} placeholder="예: 서울 송파구" />
              </div>
            </div>
            {teamMsg && <Notice kind={teamMsg.kind} className="mt12">{teamMsg.text}</Notice>}
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit" disabled={!teamDirty}>팀 정보 저장</button>
              {teamDirty && (
                <button className="btn ghost" type="button" onClick={() => { setName(team.name); setRegion(team.region); setTeamMsg(null); }}>
                  되돌리기
                </button>
              )}
            </div>
          </form>
        ) : (
          <Empty>연결된 팀 정보가 없습니다.</Empty>
        )}
      </div>

      <div className="panel">
        <div className="card-head">
          <h3>코치진</h3>
          <span className="meta">가입한 코치 계정 {coaches.length}명</span>
        </div>
        <div className="team-coaches">
          {coaches.map(c => (
            <div className="team-coach" key={c.id}>
              <Avatar name={c.name} />
              <div>
                <b>{c.name}</b>
                <small>{c.email}</small>
              </div>
              {c.id === user!.id && <span className="pill brand">나</span>}
            </div>
          ))}
        </div>

        <div className="team-subhead">
          <div>
            <h4>코치 가입 코드</h4>
            <span>새 코치에게 전달합니다. 발급 후 {CODE_VALID_DAYS}일 동안, 한 번만 쓸 수 있습니다.</span>
          </div>
          <button type="button" className="btn outline sm" onClick={() => issue({ teamId, role: "coach" })}>
            <Icon.Plus /> 코치 코드 발급
          </button>
        </div>
        {coachCodes.length === 0 ? (
          <p className="small faint">쓸 수 있는 코치 가입 코드가 없습니다.</p>
        ) : (
          <div className="team-code-list">
            {coachCodes.map(c => {
              const expired = codeState(c, today) === "만료";
              return (
                <div className="team-code-row" key={c.code}>
                  <span className={`team-code${expired ? " off" : ""}`}>{c.code}</span>
                  {c.code === fresh && <span className="pill brand">방금 발급</span>}
                  {expired ? <span className="pill warn">만료됨</span> : copyBtn(c.code)}
                  <span className={`team-code-meta grow${expired ? " warn" : ""}`}>
                    {expired ? `${c.expiresAt} 만료` : expiryText(c, today)}
                  </span>
                  <button type="button" className="btn ghost danger sm" onClick={() => { revokeCode(c.code); if (fresh === c.code) setFresh(null); }} aria-label={`${c.code} 폐기`}>
                    <Icon.Trash /> 폐기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="card-head">
          <h3>선수 · 학부모 가입 코드</h3>
          <div className="team-summary">
            <span className="pill outline">본인 가입 {joined("self")} / {players.length}</span>
            <span className="pill outline">학부모 가입 {joined("parent")} / {players.length}</span>
          </div>
        </div>
        <p className="small muted">
          계정은 선수 1명당 본인 1개·학부모 1개입니다. 코드는 발급 후 {CODE_VALID_DAYS}일 동안 한 번만 쓸 수 있고, 재발급하면 이전 코드는 쓸 수 없게 됩니다.
        </p>
        {codeError && <Notice kind="error" className="mt12">{codeError}</Notice>}
        {players.length === 0 ? (
          <Empty>등록된 선수가 없습니다. 선수단에서 선수를 먼저 등록하세요.</Empty>
        ) : (
          <div className="tbl-wrap mt12" tabIndex={0} role="region" aria-label="선수별 가입 코드 현황, 좁은 화면에서는 좌우로 스크롤">
            <table className="tbl team-codes-tbl">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>본인 계정</th>
                  <th>학부모 계정</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} className={isFreshRow(p) ? "fresh" : undefined}>
                    <td>
                      <div className="who">
                        <Avatar name={p.name} size="sm" />
                        <div className="two">
                          <span className="name">{p.name}</span>
                          <small>#{p.backNumber} · {p.grade}학년 · {playerPositionDetail(p)}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="본인 계정">{codeCell(p, "self")}</td>
                    <td data-label="학부모 계정">{codeCell(p, "parent")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
