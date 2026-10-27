# PRD: 세한 EMS 비가동 분석 시스템

## 1. 개요

세한(청주) 공장의 설비 비가동 현황을 실시간으로 분석하고 시각화하는 웹 서비스.
기존 단일 HTML 프로토타입(`docs/비가동_분석기_v4.html`)을 서버 기반 풀스택 서비스로 전환한다.

### 1.1 목표
- EMS 전류 데이터와 MOLD 생산 실적을 DB에 저장하고, 웹 UI에서 조회/분석
- 일일/주간 비가동 현황 대시보드 제공
- 설비별 가동율, 비가동 구간 상세, 생산 손실량 자동 산출
- Excel 보고서 다운로드

### 1.2 기술 스택
| 구분 | 선택 |
|------|------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Chart | Recharts |
| Backend | Next.js API Routes (Route Handlers) |
| DB | PostgreSQL (`postgresql://kbsi_app:SMmQhkEIeXivl5P0yrHWW1JhpwCcmWQg@203.255.78.89:15432/saehan?sslmode=require`) |
| ORM | Drizzle ORM |
| 배포 | Vercel |
| 패키지 매니저 | pnpm |

---

## 2. 도메인 모델

### 2.1 설비 마스터 (equipment)

공장 2개, 설비 그룹 기반. 프로토타입의 `MASTER` 배열 기준.

| 공장 | 설비 | 그룹 | 수량 |
|------|------|------|------|
| 1공장 | PET-1 ~ PET-18 | PET | 18 |
| 1공장 | PE-1 ~ PE-4 | PE | 4 |
| 1공장 | A-1 | 사출기 | 1 |
| 1공장 | B-1, B-2 | B-1, B-2 | 2 |
| 2공장 | P-1 ~ P-5 | 사출기 | 5 |
| 2공장 | S-1 ~ S-7 | 블로우 성형기(그룹별 상이) | 7 |
| **합계** | | | **37** |

### 2.2 판정 기준 (criteria)

설비 그룹별 전류 임계값 (프로토타입의 `DEFAULT_CRIT`):

| 그룹 | 완전정지 (A) | 비가동 상한 (A) | 지속 조건 (분) |
|------|-------------|----------------|---------------|
| PET | 5 | 60 | 5 |
| PE | 5 | 50 | 3 |
| 사출기 | 5 | 50 | 5 |
| B-1 | 5 | 50 | 3 |
| B-2 | 5 | 29 | 3 |
| S-1 | 5 | 40 | 3 |
| S-2 | 5 | 35 | 3 |
| S-3,5 | 5 | 60 | 3 |
| S-4 | 5 | 25 | 3 |
| S-6 | 5 | 50 | 3 |
| S-7 | 10 | 100 | 3 |

### 2.3 분석 상수

| 상수 | 값 | 설명 |
|------|----|------|
| NOPROD_STOP_MIN | 1320 | 연속 정지 이 이상이면 미가동 설비로 제외 (22시간) |
| LONG_MIN | 60 | 장시간 정지 기준 (분) |
| SHORT_MIN | 15 | 짧은 비가동 기준 (분) |
| CHG_MIN / CHG_MAX | 20 / 240 | 품종 교체 후보 구간 (분) |
| ST_GOOD | 0.95 | 가동율 양호 기준 |
| ST_WARN | 0.80 | 가동율 주의 기준 |

---

## 3. 데이터베이스 스키마

### 3.1 ems_equipment (설비 마스터)
```sql
CREATE TABLE ems_equipment (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,    -- 'PET-1', 'S-3' 등
  factory VARCHAR(10) NOT NULL,         -- '1공장', '2공장'
  "group" VARCHAR(20) NOT NULL,         -- 'PET', 'PE', '사출기', 'S-3,5' 등
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 ems_criteria (판정 기준)
```sql
CREATE TABLE ems_criteria (
  id SERIAL PRIMARY KEY,
  "group" VARCHAR(20) UNIQUE NOT NULL,
  stop_threshold NUMERIC(6,2) NOT NULL,    -- 완전정지 임계 (A)
  idle_threshold NUMERIC(6,2) NOT NULL,    -- 비가동 상한 (A)
  duration_min INT NOT NULL,               -- 지속 조건 (분)
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 ems_reading (EMS 1분 전류 데이터)
```sql
CREATE TABLE ems_reading (
  id BIGSERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  recorded_at TIMESTAMPTZ NOT NULL,        -- 1분 단위 시각
  current_value NUMERIC(8,3) NOT NULL,     -- 전류값 (A)
  UNIQUE (equipment_id, recorded_at)
);
CREATE INDEX idx_ems_reading_time ON ems_reading (recorded_at, equipment_id);
```

### 3.4 ems_mold_production (MOLD 생산 실적)
```sql
CREATE TABLE ems_mold_production (
  id BIGSERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  production_date DATE NOT NULL,
  dept_code VARCHAR(10),                   -- 부서코드 (1211, 1212, 1219)
  order_no VARCHAR(50),                    -- 작업지시번호
  item_name VARCHAR(200),                  -- 품명
  input_qty INT NOT NULL DEFAULT 0,        -- 총투입수
  good_qty INT NOT NULL DEFAULT 0,         -- 양품수
  capa_12hr NUMERIC(10,2) DEFAULT 0,       -- 12시간 CAPA (개)
  UNIQUE (equipment_id, production_date, order_no)
);
```
```

### 3.5 ems_analysis_result (분석 결과 캐시)
```sql
CREATE TABLE ems_analysis_result (
  id BIGSERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,             -- 분석 대상일
  factory VARCHAR(10),                     -- NULL이면 전체
  equipment_id INT REFERENCES ems_equipment(id),
  status VARCHAR(10) NOT NULL,             -- 'run', 'idle', 'stop'
  minutes INT NOT NULL,
  run_minutes INT NOT NULL DEFAULT 0,
  idle_minutes INT NOT NULL DEFAULT 0,
  stop_minutes INT NOT NULL DEFAULT 0,
  utilization_rate NUMERIC(5,4),
  lost_units NUMERIC(10,1),
  result_json JSONB,                       -- 상세 분석 결과 (구간, 태그 등)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (analysis_date, equipment_id)
);
```

### 3.6 ems_downtime_event (비가동 구간)
```sql
CREATE TABLE ems_downtime_event (
  id BIGSERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  state VARCHAR(10) NOT NULL,              -- 'idle' | 'stop'
  start_minute INT NOT NULL,               -- 07:00 기준 경과분
  end_minute INT NOT NULL,
  duration INT NOT NULL,
  avg_current NUMERIC(8,3),
  min_current NUMERIC(8,3),
  max_current NUMERIC(8,3),
  lost_units NUMERIC(10,1),
  tags JSONB,                              -- [{k, t, h}]
  cause VARCHAR(50),                       -- 현장 원인 기록
  memo TEXT,                               -- 수기 메모
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. API 설계

### 4.1 데이터 업로드
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload/ems` | EMS JSON 파일 업로드 → DB 저장 |
| POST | `/api/upload/mold` | MOLD .xls 파일 업로드 → 파싱 후 DB 저장 |

### 4.2 분석
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 지정일 분석 실행 (1분 전류 → 상태 분류 → 구간 탐지 → 결과 저장) |
| GET | `/api/analyze/:date` | 분석 결과 조회 (`?factory=1공장`) |

### 4.3 조회
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/equipment` | 설비 목록 |
| GET | `/api/criteria` | 판정 기준 목록 |
| PUT | `/api/criteria/:group` | 판정 기준 수정 |
| GET | `/api/dashboard/:date` | 대시보드 데이터 (전체 요약 + 설비별 가동율) |
| GET | `/api/events/:date` | 비가동 구간 목록 (`?equipment=PET-1`) |
| PATCH | `/api/events/:id` | 비가동 구간에 원인/메모 기록 |
| GET | `/api/export/:date` | Excel 보고서 다운로드 |

---

## 5. 페이지 구성

### 5.1 `/` — 대시보드 (한눈에 보기)
프로토타입의 `vSummary` 화면을 구현.

- **날짜 선택**: 기본값 = 가장 최근 분석일
- **공장 필터**: 전체 / 1공장 / 2공장
- **상단 KPI 카드 (3개)**:
  - 비가동 + 완전정지 (시간)
  - 못 만든 수량 (추정, 개)
  - 점검 필요 설비 (대)
- **평균 가동율 배너**: 큰 숫자 + 상태 뱃지 (양호/주의/점검) + 요약 문장
- **설비별 가동 구성**: 가동율 낮은 순 정렬, 스택 바 (정상/비가동/정지)
- **먼저 확인할 구간 TOP 5**: 가장 길게 멈춘 순, 상태 뱃지 + 태그
- **전력 추가 사용분**: (MOLD 있을 때) 비생산 가동 설비 테이블

### 5.2 `/equipment/:code` — 설비 상세
- 선택한 설비의 일일 전류 그래프 (1분 단위)
- 상태 타임라인 (정상가동/비가동/완전정지 색상 구분)
- 비가동 구간 목록 + 원인 기록 입력
- 생산 실적 (MOLD 데이터)

### 5.3 `/upload` — 데이터 업로드
- EMS JSON 파일 드래그앤드롭 업로드
- MOLD .xls 파일 복수 업로드
- 업로드 후 자동 분석 실행
- 업로드 이력 목록

### 5.4 `/settings` — 설정
- 판정 기준(임계값) 편집 UI
- 설비 마스터 관리

---

## 6. 분석 엔진 (서버사이드)

프로토타입의 클라이언트 JS 로직을 서버사이드 TypeScript로 이식.

### 6.1 상태 분류 (`classify`)
```
1분 전류 배열 → 각 분 상태 (정상가동 / 비가동 / 완전정지) 판정
- v <= stop_threshold → 완전정지
- stop_threshold < v <= idle_threshold 이고 지속 >= duration_min → 비가동
- 그 외 → 정상가동
- 정상가동 10분 이하 → 종일 정지 처리
```

### 6.2 구간(이벤트) 탐지
- 연속 같은 상태 구간을 하나의 이벤트로 묶음
- 태그 자동 부여: 교대 시간대, 장시간 정지, 짧은 비가동 반복, 하루 시작/끝 정지, 교체 후보

### 6.3 생산 손실 추정
- 분당 CAPA = CAPA'(12HR) / 720
- 못 만든 수량 = (비가동분 + 정지분) x 분당 CAPA
- 속도 차질 = 이론생산수 - 총투입수
- 불량 = 총투입수 - 양품수

### 6.4 비생산 가동 탐지
- EMS에 가동 흔적이 있으나 MOLD 생산 실적이 없는 설비
- 전력량 추정: sqrt(3) x V x A x 역률 x 시간

---

## 7. 비가동 원인 분류

현장 기록용 (Excel 드롭다운 및 웹 UI):
1. 품종/지시 교체
2. 금형 교체
3. 설비 고장/수리
4. 정기/예방 정비
5. 원료/부자재 대기
6. 생산 종료 (배대 종료)
7. 공통설비 (전력/에어/냉각수)
8. 테스트/시운전
9. 기타

---

## 8. Excel 보고서

프로토타입의 `exportExcel` 함수 기능을 서버사이드로 이식.

### 시트 구성:
1. **설비별_일요약**: 설비별 가동/비가동/정지 시간, MOLD 생산 실적, 기준CAPA 대비 차질, 수율
2. **비가동_구간상세**: 모든 비가동/정지 구간의 시각, 지속시간, 전류값, 태그, 원인 기록
3. **전력추가사용_비생산가동**: 생산 실적 없이 가동한 설비의 전력 소비 내역

---

## 9. 마일스톤

### Phase 1: 기반 구축
- [x] 프로젝트 생성 (Next.js + TypeScript + Tailwind + shadcn/ui)
- [x] DB 스키마 생성 (Drizzle ORM 마이그레이션) — 6개 테이블
- [x] 설비 마스터 37대 + 판정 기준 11개 시드 완료
- [x] EMS JSON 업로드 API + DB 저장 (46,112건 검증 완료)
- [x] 업로드 페이지 UI (드래그앤드롭)
- [x] 네비게이션 + 레이아웃

### Phase 2: 분석 엔진
- [x] 상태 분류 엔진 (classify) — 정상가동/비가동/완전정지 판정
- [x] 구간 탐지 + 태그 부여 (교대, 장시간, 반복, 교체 후보 등)
- [x] 분석 API (`POST /api/analyze`) — 32대 분석, 21대 가동, 11대 미가동 제외 검증
- [x] 대시보드 API (`GET /api/dashboard/:date`) — 요약 + 설비별 + TOP5 이벤트
- [x] 비가동 구간 API (`GET /api/events/:date`)
- [ ] 생산 손실 추정 (MOLD 연동 시 활성화)

### Phase 3: 대시보드 UI
- [x] 대시보드 페이지 (한눈에 보기) — 날짜 선택 + 공장 필터 + 분석 실행 버튼
- [x] 평균 가동율 배너 (verdict) — 상태 뱃지(양호/주의/점검) + 요약 문장
- [x] KPI 카드 3개 (비가동+정지 시간, 못만든수량, 점검필요 설비)
- [x] 설비별 가동 구성 스택바 — 가동율 낮은 순, 2단 레이아웃
- [x] TOP 5 비가동 구간 테이블 — 상태 뱃지 + 태그

### Phase 4: 상세 기능
- [x] 설비 상세 페이지 (`/equipment/:code`) — 전류 차트(Recharts) + 가동 KPI + 구간 목록
- [x] 비가동 원인 기록 (PATCH `/api/events/update/:id`) — 드롭다운으로 원인 선택
- [x] Excel 보고서 다운로드 (`GET /api/export/:date`) — 2시트 (일요약 + 구간상세)
- [x] 설정 페이지 (`/settings`) — 판정 기준 인라인 편집
- [x] 대시보드에서 설비 클릭 → 상세 페이지 링크
- [x] 대시보드 엑셀 다운로드 버튼
- [ ] MOLD 업로드 + 파싱 (Phase 5에서)

### Phase 5: 운영
- [ ] Vercel 배포
- [ ] MOLD 업로드 + 파싱 → 생산 손실 추정 활성화
- [ ] 반응형 레이아웃 최적화
