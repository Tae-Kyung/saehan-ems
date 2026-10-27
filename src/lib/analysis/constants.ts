// 분석 상수 (프로토타입 기준)
export const NOPROD_STOP_MIN = 1320; // 연속 정지 이 이상이면 미가동 설비 제외 (22시간)
export const LONG_MIN = 60; // 장시간 정지 기준 (분)
export const SHORT_MIN = 15; // 짧은 비가동 기준 (분)
export const CHG_MIN = 20; // 품종 교체 후보 최소 (분)
export const CHG_MAX = 240; // 품종 교체 후보 최대 (분)
export const ST_GOOD = 0.95; // 가동율 양호 기준
export const ST_WARN = 0.80; // 가동율 주의 기준
export const DAY_MINUTES = 1440; // 하루 = 07:00 ~ 익일 07:00

// 비가동 원인 분류
export const CAUSES = [
  "품종·지시 교체",
  "금형 교체",
  "설비 고장·수리",
  "정기·예방 정비",
  "원료·부자재 대기",
  "생산 종료(배대 종료)",
  "공통설비(전력·에어·냉각수)",
  "테스트·시운전",
  "기타",
] as const;

// EMS 컬럼명 → 표준 설비코드 매핑
export function mapEmsColumn(col: string): string | null {
  if (!/전류\s*$/.test(col)) return null;
  let m: RegExpMatchArray | null;
  if ((m = col.match(/^PET\s*-?\s*(\d+)\s*호/))) return `PET-${+m[1]}`;
  if ((m = col.match(/^PE\s*-?\s*(\d+)\s*호/))) return `PE-${+m[1]}`;
  if ((m = col.match(/^사출기\s*-?\s*(\d+)\s*호/))) return `A-${+m[1]}`;
  if ((m = col.match(/^블로우기\s*-?\s*(\d+)\s*호/))) return `B-${+m[1]}`;
  if ((m = col.match(/프리폼\s*사출기\s*\(?\s*P\s*-?\s*(\d+)/))) return `P-${+m[1]}`;
  if ((m = col.match(/블로우\s*성형기\s*\(?\s*S\s*-?\s*(\d+)/))) return `S-${+m[1]}`;
  return null;
}
