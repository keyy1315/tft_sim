# 작업 세션 요약 (2026-06-17 ~ 2026-07-06)

> TFT 시뮬레이터 프로젝트에서 진행한 4개 독립 작업 + 부수 작업 기록.
> 대화 흐름과 각 작업의 원인·결정·검증·산출물을 정리한다.

---

## 1. 배포 1단계 — Docker + GitHub Actions (ghcr → Lightsail)

**요청**: "도커로 말아서 깃헙 액션으로 배포하고 싶은데 어떻게 시작할까? 지금은 버셀로 붙어있어"

**맥락**: 배포 학습 목적. 실무는 API 서버가 이미 GitHub Actions + Docker + EC2로 운영 중이고, 차장님이 "프론트 서버도 도커 이미지로 말아서 올려라" 지시. 연습 환경으로 Lightsail 인스턴스 사용.

**워크플로우**: brainstorming → writing-plans → subagent-driven-development

**결정 사항**:
- 배포 타겟: AWS Lightsail VPS (x86/amd64), 내부 IP:3000 노출 (도메인/HTTPS 없음)
- 배포 방식: **A안** — ghcr 푸시 + SSH pull (`docker compose pull && up -d`)
- 레지스트리: **1단계 ghcr** → 2단계 ECR(OIDC/IAM) 후속 (단계적 학습)
- 품질 게이트: 배포 전 `lint && typecheck && test` 강제
- 베이스 이미지: `node:24-alpine`

**환경변수 분리** (핵심):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → 빌드 ARG (publishable)
- `RIOT_API_KEY` → 런타임 주입 (이미지 미인라인)

**산출물** (PR #275, **머지됨**):
- `next.config.ts` (standalone), `Dockerfile`(멀티스테이지 deps/build/runner, non-root)
- `.dockerignore`, `docker-compose.yml`(서버 배치용)
- `.github/workflows/deploy.yml` (quality → build-push(ghcr) → deploy(SSH) 3잡)
- `docs/deploy/lightsail-setup.md` (Secrets 6종 + 서버 셋업 가이드)
- README 배포 섹션

**로컬 검증 통과**: `pnpm build` standalone / `docker build` (403MB) / `docker run`+`curl` 200 / RIOT 키 미인라인 / typecheck·lint·YAML

**설계/플랜 문서**:
- `docs/superpowers/specs/2026-06-17-docker-github-actions-deploy-design.md`
- `docs/superpowers/plans/2026-06-17-docker-gha-deploy-stage1.md`

**미완결**:
- GitHub Secrets: `NEXT_PUBLIC_*` 2종은 등록 완료. `LIGHTSAIL_HOST/USER/SSH_KEY`, `GHCR_PULL_TOKEN` 4종 미등록
- Lightsail 서버 셋업 (Docker 설치, ghcr 로그인, compose+.env 배치, 방화벽 3000)
- 2단계 ECR 전환 (별도 사이클, 설계 §9)

---

## 2. 파비콘(펭구 아이콘) 깨짐 수정

**요청**: "탭에 붙어있는 아이콘 펭구의 흰색 화면이 투명하게 나와"

**디버깅** (systematic-debugging): 처음엔 챔피언 토큰 이슈로 오판 → 실제는 **브라우저 탭 favicon** 문제로 확인.

**Root cause** (픽셀 분석으로 확정):
- `icon.png`의 펭귄 흰색 영역이 `[0,0,0,0]`(투명한 검정)으로 저장됨
- 흰색 색 정보 자체가 손실 (투명 픽셀 중 흰색 RGB 0%)
- 다크 탭에서 얼굴/몸이 배경색으로 뚫려 보임
- "알파만 복원"으로는 검은 펭귄이 나와서 불가 → 재생성 필요

**해결**:
- 투명 영역 → 흰색 복원 (canvas 합성)
- 둥근 모서리 외부 → corner flood-fill + dilate로 배경 남색 채움 (정사각형 단색 배경)
- 4개 파일: `src/app/icon.png`(512), `public/icon-512.png`, `public/icon-192.png`, `src/app/apple-icon.png`(180)

**검증**: 얼굴 픽셀 `[0,0,0,0]` → `[255,255,255,255]`, 투명 0, 다크 배경 시각 확인 / 흰 바탕에서 모서리 틈 0

**참고**: 크롬 favicon 캐시가 끈질겨서 하드리프레시로도 안 바뀜 → 시크릿 창/Clear site data로 확인 필요

**상태**: `fix/favicon-navy-icon` → **main 머지·push 완료** (`030ddf2`)

---

## 3. TFT 17.6 패치 위키 + 백로그

**요청**: "오늘 17.6패치있을텐데 찾아봐줘" → "17.6 변경분 위키/백로그에 기록해줘"

**17.6 요약** (2026-06-23 LIVE, 3주 패치):
- 증강 대규모 패스(lobby shape 의존도 완화)가 핵심
- 챔프 버프: 빅토르(200/300/530)·모데·TF·룰루·아우솔·카르마·르블랑·모르가나·마이·나미 / 쉔 공속 비감쇠 / 그나르 AD 48 너프
- 시너지: 중재자·N.O.V.A·양치기 버프, 미플(7)·메카 너프
- Best Friends Armor+MR, Blood Offering AP 추가, Critical Success 비활성

**산출물** (이전 세션이 작성해둔 것을 검증·커밋):
- `docs/wiki/patches/patch-17-6.md` — 변경 fact + sim 미반영/calibration 재기준 노트
- `docs/wiki/index.md` — 17-6 등록
- `docs/superpowers/plans/2026-06-26-patch-17-6-data-update.md` — raw 데이터 17.5+17.6 누적 갱신 백로그 플랜 (Phase 1~8)

**검증**: 공식 17.6과 수치 정합 / related 챔프 13개 dead link 없음

**상태**: `docs/wiki-patch-17-6` 브랜치에 커밋 (`6c96f76`) — ⏳ **미푸시/미머지** (유일한 미완결)

**주의**: raw data/sim은 여전히 17.4 partial 기준 미반영. calibration 게임(17.1/17.3)이라 17.6 raw 갱신 시 신규 게임 baseline 재기준 필요.

---

## 4. 챔피언 아이콘 pHash + PNG (simpty-coach 프로젝트로 출력)

**요청**: 챔피언 아이콘 pHash를 `{챔피언명: 해시}` JSON으로 만들어 `simpty-coach/data/champions`에 저장 + 실제 PNG도 복사

**결정**: 키 = apiName / 전체 69개(보조유닛 포함) / PNG는 `{apiName}_square.png`로 리네임 **복사**(원본 tft_sim 보존)

**구현**:
- `imagehash.phash` (64bit, 16 hex) — `.venv`(uv)에 imagehash/PIL 기설치 활용
- apiName 역매핑: `champions.json` + specialUnits apiName을 `getChampionImage` 로직으로 파일명 역산
- 데이터 미수록 2개(`meepsie`, `themightymech`)는 Riot CamelCase 추정 (`TFT17_Meepsie`, `TFT17_TheMightyMech`)

**산출물** (`/Users/kim/projects/simpty-coach/data/champions/`):
- `phash.json` — 69개 `{apiName: pHash}` (해시 충돌 0)
- `images/` — 69개 `{apiName}_square.png`
- 재생성 스크립트: `/tmp/phash_gen.py` (pHash + PNG 복사 일괄)

---

## 미결 항목 (다음 세션)

1. **17.6 위키 브랜치** `docs/wiki-patch-17-6` (`6c96f76`) → main 머지/push 여부 결정
2. **배포 Secrets 4종** (`LIGHTSAIL_*`, `GHCR_PULL_TOKEN`) + **Lightsail 서버 셋업** (배포 PR은 머지됐으나 실배포 미완)
3. 배포 2단계 ECR 전환 (선택)
4. raw 데이터 17.6 갱신 (백로그 플랜 존재, calibration 재기준 동반 필요)

## 주요 학습 / 결정 패턴

- **성격이 다른 작업은 main 기반 별도 브랜치로 분리** (파비콘 fix / 배포 feat / 위키 docs 각각)
- **자산 손상은 코드로 못 고친다** — 파비콘 흰색 정보 손실 → 재생성
- **배포는 단계적 학습** — ghcr로 흐름 익히고 → ECR로 실무 정렬
- **크롬 favicon 캐시**는 매우 끈질김 — 시크릿 창으로 검증
