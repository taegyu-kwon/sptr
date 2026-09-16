import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer, latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { nextBackNumber } from "../../lib/roster";
import type { PlayerKind, Position } from "../../lib/types";
import { Avatar, Cell, Cells, Empty, GradeBadge, Notice, PageHead, RiskPill } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/coach.css";
import "../../styles/roster.css";

const POSITIONS: Position[] = ["투수", "포수", "내야수", "외야수"];
const KINDS: PlayerKind[] = ["투수", "야수"];
const GRADES = [1, 2, 3];

/** 빈 칸은 숫자가 아닌 값으로 돌려 검증에서 걸러낸다 */
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export default function PlayersPage() {
  const { db, user, addPlayer } = useStore();
  const nav = useNavigate();
  const teamId = user!.teamId;
  const players = db.players.filter(p => p.teamId === teamId);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("투수");
  const [backNumber, setBackNumber] = useState(String(nextBackNumber(db.players, teamId)));
  const [grade, setGrade] = useState("1");
  const [kind, setKind] = useState<PlayerKind>("투수");
  const [age, setAge] = useState("14");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** 가입 코드는 옮겨 적어야 하므로 코치가 닫을 때까지 남긴다 */
  const [done, setDone] = useState<{ name: string; code: string } | null>(null);

  const resetForm = () => {
    setName("");
    setPosition("투수");
    setBackNumber(String(nextBackNumber(db.players, teamId)));
    setGrade("1");
    setKind("투수");
    setAge("14");
    setHeight("");
    setWeight("");
    setError(null);
  };

  const toggleForm = () => {
    if (open) {
      setOpen(false);
      setError(null);
    } else {
      resetForm();
      setOpen(true);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const bn = num(backNumber);
    const ageN = num(age);
    const heightN = num(height);
    const weightN = num(weight);

    if (!trimmed) return setError("선수 이름을 입력하세요.");
    if (players.some(p => p.name === trimmed))
      return setError("같은 이름의 선수가 이미 있습니다. 구분할 수 있게 입력하세요.");
    if (!Number.isFinite(bn) || bn < 0 || bn > 99)
      return setError("등번호는 0에서 99 사이의 숫자로 입력하세요.");
    const dup = players.find(p => p.backNumber === bn);
    if (dup) return setError(`등번호 ${bn}번은 ${dup.name} 선수가 쓰고 있습니다. 다른 번호를 입력하세요.`);
    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 19)
      return setError("나이는 10세에서 19세 사이로 입력하세요.");
    if (!Number.isFinite(heightN) || heightN < 120 || heightN > 210)
      return setError("키는 120cm에서 210cm 사이로 입력하세요.");
    if (!Number.isFinite(weightN) || weightN < 25 || weightN > 150)
      return setError("몸무게는 25kg에서 150kg 사이로 입력하세요.");

    const { code } = addPlayer(teamId, {
      name: trimmed,
      position,
      backNumber: bn,
      grade: Number(grade),
      kind,
      age: ageN,
      height: heightN,
      weight: weightN,
    });

    setOpen(false);
    resetForm();
    setDone({ name: trimmed, code });
  };

  const rows = players.map(p => ({ p, r: evaluatePlayer(p), s: latest(p), idx: evaluatePlayerSbi(p) }));
  const n = rows.length;
  const avg = n ? rows.reduce((sum, x) => sum + x.r.total, 0) / n : 0;
  const sCount = rows.filter(x => x.r.totalGrade === "S").length;
  const aCount = rows.filter(x => x.r.totalGrade === "A").length;
  const highRisk = rows.filter(x => x.r.injuryRisk.level === "높음").length;
  const midRisk = rows.filter(x => x.r.injuryRisk.level === "보통").length;

  return (
    <>
      <PageHead
        title="팀 내 선수 프로필"
        desc="선수를 클릭하면 프로필과 전체 데이터를 열람할 수 있습니다."
        actions={
          <button type="button" className={open ? "btn outline" : "btn"} onClick={toggleForm}>
            {open ? <Icon.X /> : <Icon.Plus />}
            {open ? "닫기" : "선수 등록"}
          </button>
        }
      />

      <div className="panel tint">
        <Cells n={4}>
          <Cell label="총원" value={n} unit="명" />
          <Cell label="팀 평균 종합" value={n ? avg.toFixed(1) : "-"} unit="점" sub="최신 측정 기준" />
          <Cell label="S·A 등급" value={sCount + aCount} unit="명" sub={`S ${sCount}명 · A ${aCount}명`} />
          <Cell label="부상위험 높음" value={highRisk} unit="명" sub={`보통 ${midRisk}명`} />
        </Cells>
      </div>

      {done && (
        <Notice kind="ok" className="roster-code mt12">
          <div className="flex between wrap gap12">
            <div>
              {done.name} 선수를 등록했습니다. 가입 코드{" "}
              <span className="mono strong code">{done.code}</span> — 선수에게 전달하세요.
            </div>
            <button type="button" className="icon-btn sm" aria-label="알림 닫기" onClick={() => setDone(null)}>
              <Icon.X />
            </button>
          </div>
        </Notice>
      )}

      {open && (
        <div className="panel">
          <div className="card-head">
            <h3>선수 등록</h3>
            <span className="meta">등록하면 가입 코드가 함께 발급됩니다</span>
          </div>
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
              <div className="field">
                <label>선수 유형</label>
                <select value={kind} onChange={e => setKind(e.target.value as PlayerKind)}>
                  {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="field">
                <label>나이</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} />
              </div>
              <div className="field">
                <label>키 (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170" />
              </div>
              <div className="field">
                <label>몸무게 (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="65" />
              </div>
              <div className="field span-all">
                <span className="help">
                  이름·포지션·등번호·학년과 첫 측정값(나이·키·몸무게)만 등록합니다. 나머지 측정 항목은 기본값으로
                  저장되며, 선수가 로그인해 '데이터 입력'에서 갱신합니다.
                </span>
              </div>
            </div>
            {error && <Notice kind="error" className="mt12">{error}</Notice>}
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit">선수 등록</button>
              <button className="btn ghost" type="button" onClick={toggleForm}>닫기</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        {n === 0 ? (
          <Empty>등록된 선수가 없습니다. 위 '선수 등록'에서 선수를 추가하세요.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl players-tbl">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>신체</th>
                  <th className="num">종합</th>
                  <th>분야 등급</th>
                  <th className="num">SBI</th>
                  <th className="num">SMI</th>
                  <th className="num">최종 R</th>
                  <th>리스크</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, r, s, idx }) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                    <td>
                      <div className="who">
                        <Avatar name={p.name} size="sm" />
                        <div className="two">
                          <b>{p.name}</b>
                          <small>{p.position} · {p.grade}학년 · #{p.backNumber}</small>
                        </div>
                      </div>
                    </td>
                    <td className="dim">{s.body.height}cm / {s.body.weight}kg</td>
                    <td className="num">
                      <span className="flex gap8">
                        <b>{r.total}</b>
                        <GradeBadge grade={r.totalGrade} size={20} />
                      </span>
                    </td>
                    <td>
                      <span className="flex gap6">
                        <span title="신체"><GradeBadge grade={r.body.grade} size={20} /></span>
                        <span title="운동능력"><GradeBadge grade={r.athletic.grade} size={20} /></span>
                        <span title="실전"><GradeBadge grade={r.practical.grade} size={20} /></span>
                      </span>
                    </td>
                    <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                    <td className="num">{idx ? r1(idx.smi) : "-"}</td>
                    <td className="num">
                      <span className="brand-text strong">{idx ? r1(idx.finalR) : "-"}</span>
                    </td>
                    <td><RiskPill level={r.injuryRisk.level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
