import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import PlayerReport from "../../components/PlayerReport";
import { fmtDate } from "../../lib/format";
import type { Position } from "../../lib/types";
import { Cell, Cells, Notice, PageHead, Section } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/roster.css";

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v}`;
const POSITIONS: Position[] = ["투수", "포수", "내야수", "외야수"];
const GRADES = [1, 2, 3];

export default function PlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updatePlayer, removePlayer } = useStore();
  const player = db.players.find(p => p.id === id);

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("투수");
  const [backNumber, setBackNumber] = useState("");
  const [grade, setGrade] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button type="button" className="btn secondary" onClick={() => nav("/c/players")}>목록으로</button>}
      />
    );
  }

  const s = latest(player);
  const injury = s.body.injuryHistory.trim();

  const teammates = db.players.filter(p => p.teamId === player.teamId);
  const code = db.codes.find(c => c.teamId === player.teamId && c.playerName === player.name);
  const account = db.users.find(u => u.playerId === player.id);

  const openEdit = () => {
    setName(player.name);
    setPosition(player.position);
    setBackNumber(String(player.backNumber));
    setGrade(String(player.grade));
    setError(null);
    setConfirmDel(false);
    setEdit(true);
  };

  const closeEdit = () => {
    setEdit(false);
    setError(null);
    setConfirmDel(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const bn = backNumber.trim() === "" ? NaN : Number(backNumber);

    if (!trimmed) return setError("선수 이름을 입력하세요.");
    if (teammates.some(p => p.id !== player.id && p.name === trimmed))
      return setError("같은 이름의 선수가 이미 있습니다. 구분할 수 있게 입력하세요.");
    if (!Number.isFinite(bn) || bn < 0 || bn > 99)
      return setError("등번호는 0에서 99 사이의 숫자로 입력하세요.");
    const dup = teammates.find(p => p.id !== player.id && p.backNumber === bn);
    if (dup) return setError(`등번호 ${bn}번은 ${dup.name} 선수가 쓰고 있습니다. 다른 번호를 입력하세요.`);

    updatePlayer(player.id, { name: trimmed, position, backNumber: bn, grade: Number(grade) });
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const header = (
    <div className="flex between wrap gap16">
      <div className="profile">
        <div className="profile-num">{player.backNumber}</div>
        <div>
          <div className="profile-name">{player.name}</div>
          <div className="profile-meta">
            <span>{player.position}</span>
            <span className="sep" />
            <span>{player.grade}학년</span>
            <span className="sep" />
            <span>측정 {player.records.length}회</span>
            <span className="sep" />
            <span>최근 {fmtDate(s.date)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap8 wrap end">
        <button type="button" className="btn ghost sm" onClick={() => nav("/c/players")}>
          <Icon.ArrowLeft />
          선수 목록
        </button>
        <button type="button" className="btn outline sm" onClick={() => (edit ? closeEdit() : openEdit())}>
          {edit ? "수정 닫기" : "정보 수정"}
        </button>
      </div>
    </div>
  );

  const editSection = (
    <Section title="선수 정보 수정">
      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>이름</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="선수 이름" />
            </div>
            <div className="field">
              <label>포지션</label>
              <select value={position} onChange={e => setPosition(e.target.value as Position)}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>등번호</label>
              <input type="number" value={backNumber} onChange={e => setBackNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>학년</label>
              <select value={grade} onChange={e => setGrade(e.target.value)}>
                {GRADES.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
              </select>
            </div>
            <div className="field span-all">
              <span className="help">
                이름을 바꾸면 가입 코드에 적힌 선수 이름과 연결된 계정 이름도 함께 바뀝니다.
              </span>
            </div>
          </div>
          {error && <Notice kind="error" className="mt12">{error}</Notice>}
          {saved && <Notice kind="ok" className="mt12">수정했습니다.</Notice>}
          <div className="flex gap12 wrap mt16">
            <button className="btn" type="submit">수정 저장</button>
            <button className="btn ghost" type="button" onClick={closeEdit}>취소</button>
          </div>
        </form>

        <div className="divider" />

        <div className="flex between wrap gap12 roster-del">
          <span className="small faint">
            선수를 삭제하면 계정·피드백·라인업 배치·시합 기록에서도 함께 지워집니다. 되돌릴 수 없습니다.
          </span>
          {confirmDel ? (
            <span className="flex gap8 wrap">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  removePlayer(player.id);
                  nav("/c/players");
                }}
              >
                정말 삭제
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>취소</button>
            </span>
          ) : (
            <button type="button" className="btn ghost danger" onClick={() => setConfirmDel(true)}>
              <Icon.Trash />
              선수 삭제
            </button>
          )}
        </div>
      </div>
    </Section>
  );

  const after = (
    <>
      {edit && editSection}

      <Section title="신체·실전 요약">
        <div className="panel sub">
          <Cells n={4}>
            <Cell
              label="신장 / 체중"
              size="md"
              value={<>{s.body.height}<span className="unit">cm</span> / {s.body.weight}<span className="unit">kg</span></>}
              sub={`골격근 ${s.body.skeletalMuscle}kg · 체지방 ${s.body.bodyFat}% · 윙스팬 ${s.body.wingspan}cm`}
            />
            <Cell
              label="최근 1년 성장"
              size="md"
              value={<>{signed(s.body.heightChange1y)}<span className="unit">cm</span> / {signed(s.body.weightChange1y)}<span className="unit">kg</span></>}
              sub={`관절 가동범위 ${s.body.jointROM}/100`}
            />
            <Cell
              label={s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}
              size="md"
              value={s.practical.maxVelo}
              unit="km/h"
              sub={`멀리던지기 ${s.practical.longThrow}m · 커맨드 ${s.practical.command}`}
            />
            <Cell
              label="부상/통증 이력"
              size="sm"
              value={injury || "없음"}
              sub={`에러율 ${s.practical.errorRate}%`}
            />
          </Cells>
        </div>
      </Section>

      <Section title="계정">
        <div className="panel sub">
          <div className="kv">
            <div className="kv-row">
              <span className="k">가입 코드</span>
              <span className="v mono">{code ? code.code : "코드 없음"}</span>
            </div>
            <div className="kv-row">
              <span className="k">상태</span>
              <span className="v">
                {code
                  ? code.used
                    ? <span className="pill good">가입 완료</span>
                    : <span className="pill outline">미가입</span>
                  : <span className="pill outline">코드 없음</span>}
              </span>
            </div>
            <div className="kv-row">
              <span className="k">연결된 계정</span>
              <span className="v">{account ? account.email : "없음"}</span>
            </div>
          </div>
        </div>
      </Section>
    </>
  );

  return <PlayerReport player={player} header={header} after={after} />;
}
