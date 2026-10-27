import type { StatusLabel } from "./classify";
import { LONG_MIN, SHORT_MIN, CHG_MIN, CHG_MAX, DAY_MINUTES } from "./constants";

export interface DowntimeEventData {
  equipmentCode: string;
  factory: string;
  state: "idle" | "stop";
  startMinute: number;
  endMinute: number;
  duration: number;
  avgCurrent: number;
  minCurrent: number;
  maxCurrent: number;
  lostUnits: number;
  tags: Tag[];
}

export interface Tag {
  k: string;
  t: string;
  h: string;
}

interface DetectOptions {
  equipmentCode: string;
  factory: string;
  statuses: StatusLabel[];
  current: number[];
  perMin: number; // 분당 생산능력
  orderCount: number; // 작업지시 건수 (교체 판별용)
  itemCount: number; // 품목 수
}

export function detectEvents(opts: DetectOptions): DowntimeEventData[] {
  const { statuses, current, perMin, orderCount, itemCount } = opts;
  const N = statuses.length;
  const events: DowntimeEventData[] = [];

  // 연속 같은 상태 구간을 이벤트로 묶음
  let i = 0;
  while (i < N) {
    if (statuses[i] === "정상가동") {
      i++;
      continue;
    }
    let j = i;
    while (j < N && statuses[j] === statuses[i]) j++;

    const seg = current.slice(i, j);
    events.push({
      equipmentCode: opts.equipmentCode,
      factory: opts.factory,
      state: statuses[i] === "완전정지" ? "stop" : "idle",
      startMinute: i,
      endMinute: j,
      duration: j - i,
      avgCurrent: seg.reduce((a, b) => a + b, 0) / seg.length,
      minCurrent: Math.min(...seg),
      maxCurrent: Math.max(...seg),
      lostUnits: (j - i) * perMin,
      tags: [],
    });
    i = j;
  }

  // 짧은 비가동 반복 횟수
  const shortRepCount = events.filter(
    (ev) => ev.state === "idle" && ev.duration < SHORT_MIN
  ).length;

  // 교체 후보 판별
  const chgN = Math.max(0, orderCount - 1);
  const chgCandidates = chgN
    ? events
        .filter(
          (ev) =>
            ev.startMinute > 0 &&
            ev.endMinute < N &&
            ev.duration >= CHG_MIN &&
            ev.duration <= CHG_MAX
        )
        .sort((a, b) => b.duration - a.duration)
        .slice(0, chgN)
    : [];
  const chgSet = new Set(chgCandidates);

  // 태그 부여
  for (const ev of events) {
    const tags: Tag[] = [];

    if (chgSet.has(ev)) {
      tags.push({
        k: "chg",
        t: "교체 후보",
        h: `생산 지시 ${orderCount}건(품명 ${itemCount}종) — 교체 ${chgN}번 추정. 이 구간이 교체인지 확인하세요.`,
      });
    }

    const hm = ev.startMinute % 720;
    if (ev.startMinute > 0 && (hm < 30 || hm >= 690)) {
      tags.push({
        k: "shift",
        t: "교대 시간대",
        h: "인수인계·교대 준비 중 정지인지 확인",
      });
    }

    if (ev.startMinute === 0) {
      tags.push({
        k: "start",
        t: "하루 시작 시점부터 정지",
        h: "전일 연속 정지/생산 준비 지연 여부 확인",
      });
    }

    if (ev.endMinute === N && N === DAY_MINUTES) {
      tags.push({
        k: "end",
        t: "다음 날 07:00까지 이어짐",
        h: "생산 지시 종료·금형 교체·고장 대기 중 어느 것인지 확인",
      });
    }

    if (ev.duration >= LONG_MIN) {
      tags.push({
        k: "long",
        t: `장시간 ${ev.duration}분`,
        h: "금형·품종 교체, 고장, 자재 대기 중 어느 것인지 확인",
      });
    } else if (
      ev.state === "idle" &&
      ev.duration < SHORT_MIN &&
      shortRepCount >= 5
    ) {
      tags.push({
        k: "rep",
        t: `짧은 비가동 반복(${shortRepCount}회)`,
        h: "소소정지(취출·센서·자재 공급) 반복 여부 확인",
      });
    }

    ev.tags = tags;
  }

  return events;
}
