/** 분 → "HH:MM" (07:00 기준 오프셋) */
export function minuteToTime(minute: number): string {
  const totalMin = (7 * 60 + minute) % (24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 분 → "Xh Ym" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 소수 → "XX.X%" */
export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** 숫자 천단위 쉼표 */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}
