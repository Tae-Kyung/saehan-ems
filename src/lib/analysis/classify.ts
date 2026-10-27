export type StatusLabel = "정상가동" | "비가동" | "완전정지";

/**
 * 1분 전류 배열 → 각 분 상태 판정
 * - v <= stopThreshold → 완전정지
 * - stopThreshold < v <= idleThreshold 이고 연속 >= durationMin → 비가동
 * - 그 외 → 정상가동
 * - 정상가동 10분 이하 → 종일 정지 처리
 */
export function classify(
  current: number[],
  stopThreshold: number,
  idleThreshold: number,
  durationMin: number
): StatusLabel[] {
  const n = current.length;
  const st: StatusLabel[] = new Array(n).fill("정상가동");

  const isStop = current.map((v) => v <= stopThreshold);
  const isBand = current.map((v, i) => !isStop[i] && v <= idleThreshold);

  // 완전정지
  for (let i = 0; i < n; i++) {
    if (isStop[i]) st[i] = "완전정지";
  }

  // 비가동: 밴드 내 연속 구간이 durationMin 이상이면 비가동
  let i = 0;
  while (i < n) {
    if (isBand[i]) {
      let j = i;
      while (j < n && isBand[j]) j++;
      if (j - i >= durationMin) {
        for (let k = i; k < j; k++) st[k] = "비가동";
      }
      i = j;
    } else {
      i++;
    }
  }

  // 정상가동 10분 이하면 종일 정지 처리
  const runCount = st.filter((s) => s === "정상가동").length;
  if (runCount <= 10) {
    return new Array(n).fill("완전정지");
  }

  return st;
}

/** 최대 연속 완전정지 분 수 */
export function maxConsecutiveStop(statuses: StatusLabel[]): number {
  let best = 0;
  let cur = 0;
  for (const s of statuses) {
    if (s === "완전정지") {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}
