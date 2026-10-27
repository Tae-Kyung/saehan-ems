# 새한 EMS 비가동 분석 시스템

## 프로젝트 개요
새한(청주) 공장 설비의 비가동 현황을 분석/시각화하는 웹 서비스.
EMS 전류 데이터(1분 단위)와 MOLD 생산 실적을 기반으로 가동율, 비가동 구간, 생산 손실량을 산출한다.

## 기술 스택
- **Framework**: Next.js 15 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Recharts
- **ORM**: Drizzle ORM
- **DB**: PostgreSQL (`postgresql://kbsi_app:SMmQhkEIeXivl5P0yrHWW1JhpwCcmWQg@203.255.78.89:15432/saehan?sslmode=require`)
- **Deploy**: Vercel
- **Package Manager**: pnpm

## 핵심 명령어
```bash
pnpm dev          # 개발 서버
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
pnpm db:generate  # Drizzle 스키마 → 마이그레이션 생성
pnpm db:migrate   # 마이그레이션 실행
pnpm db:push      # 스키마를 DB에 직접 반영 (개발용)
pnpm db:seed      # 시드 데이터 (설비 마스터 + 판정 기준)
```

## 프로젝트 구조
```
src/
  app/                    # Next.js App Router 페이지
    page.tsx              # 대시보드 (한눈에 보기)
    upload/page.tsx       # 데이터 업로드
    equipment/[code]/     # 설비 상세
    settings/page.tsx     # 설정 (판정 기준)
    api/                  # API Route Handlers
      upload/ems/         # EMS JSON 업로드
      upload/mold/        # MOLD .xls 업로드
      analyze/            # 분석 실행/조회
      dashboard/[date]/   # 대시보드 데이터
      events/             # 비가동 구간
      equipment/          # 설비 목록
      criteria/           # 판정 기준
      export/[date]/      # Excel 다운로드
  lib/
    db/
      schema.ts           # Drizzle ORM 스키마
      index.ts            # DB 연결
      seed.ts             # 시드 데이터
    analysis/
      classify.ts         # 상태 분류 엔진
      detect-events.ts    # 구간 탐지 + 태그
      production-loss.ts  # 생산 손실 추정
      constants.ts        # 분석 상수
    utils.ts              # 공통 유틸
  components/
    dashboard/            # 대시보드 UI 컴포넌트
    ui/                   # shadcn/ui 컴포넌트
```

## 도메인 규칙
- 하루 = 07:00 ~ 익일 07:00 (1440분)
- 상태: 정상가동 / 비가동 / 완전정지 (전류 임계값 기반)
- 정상가동 10분 이하 → 종일 정지 처리
- 연속 정지 1320분(22시간) 이상 → 미가동 설비로 분석 제외
- 비가동 원인: 품종교체, 금형교체, 고장수리, 정비, 자재대기, 생산종료, 공통설비, 테스트, 기타

## 설비 구성
- 1공장: PET-1~18, PE-1~4, A-1, B-1, B-2 (25대)
- 2공장: P-1~5, S-1~7 (12대)
- 총 37대

## 참고
- 프로토타입: `docs/비가동_분석기_v4.html` (분석 로직/UI 원본)
- 샘플 데이터: `docs/ems_20261013.json` (2026-10-13 하루치 1분 전류)
- PRD: `PRD.md`

## 코딩 컨벤션
- 한국어 UI, 영문 코드
- DB 테이블명: `ems_` 접두사 (ems_equipment, ems_criteria, ems_reading, ems_mold_production, ems_analysis_result, ems_downtime_event)
- DB 컬럼명: snake_case
- TypeScript strict mode
- 컴포넌트: 서버 컴포넌트 우선, 인터랙션 필요시 "use client"
- API 응답: `{ data, error, message }` 형식
