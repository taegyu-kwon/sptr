/* 서버 쓰기 대기열 — 낙관적으로 고친 메모리 변경을 순서대로 서버에 쓴다.
   실패하면 그 변경을 되돌리고(rollback) 뒤에 줄 선 쓰기는 버린 다음, 실패 처리기(토스트 + 다시 읽기)를 부른다. */
export type Op = () => Promise<void>;

export interface Batch {
  ops: Op[];
  /** 이 변경 직전의 메모리 상태로 되돌린다 */
  rollback: () => void;
  /** true 면 실패해도 조용히 넘어간다(공지 읽음 표시처럼 다음에 다시 시도되는 쓰기) */
  soft?: boolean;
}

let chain: Promise<void> = Promise.resolve();
let pending = 0;
let seq = 0;
let epoch = 0;
let onFailure: (err: unknown) => void = () => {};

/** 쓰기가 진행 중인지 — 진행 중에는 서버 다시 읽기를 건너뛴다 */
export const isWriting = () => pending > 0;
/** 지금까지 받은 쓰기 수 — 다시 읽는 사이에 새 쓰기가 생겼는지 확인하는 데 쓴다 */
export const writeSeq = () => seq;
export const setFailureHandler = (fn: (err: unknown) => void) => { onFailure = fn; };
/** 대기 중인 쓰기를 모두 버린다(로그아웃·실패 뒤) */
export const dropQueue = () => { epoch++; };
/** 대기 중인 쓰기가 모두 끝날 때까지 기다린다 */
export const flushWrites = () => chain;

export function enqueue(batch: Batch) {
  if (batch.ops.length === 0) return;
  seq++;
  pending++;
  const mine = epoch;
  chain = chain.then(async () => {
    try {
      if (mine !== epoch) return; // 앞선 쓰기가 실패해 버려진 변경
      for (const op of batch.ops) await op();
    } catch (err) {
      if (batch.soft) return;
      if (mine === epoch) {
        epoch++;
        batch.rollback();
        onFailure(err);
      }
    } finally {
      pending--;
    }
  });
}
