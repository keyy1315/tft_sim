# Docker + GitHub Actions 배포 설계 (Vercel → 자체 VPS)

- **작성일**: 2026-06-17
- **대상 레포**: `keyy1315/tft_sim`
- **이미지 경로**: `ghcr.io/keyy1315/tft_sim`
- **현 상태**: Vercel Git 연동 배포 → AWS Lightsail VPS(자체 호스팅)로 이전

---

## 1. 목표와 범위

### 목표
`main` 브랜치 푸시 시, GitHub Actions가 품질 게이트를 통과한 뒤 Docker 이미지를 빌드해
GitHub Container Registry(`ghcr.io`)에 푸시하고, SSH로 Lightsail 인스턴스에 접속해
새 이미지를 pull·재시작하는 **완전 자동 배포 파이프라인**을 구축한다.

### 결정 사항 (브레인스토밍 합의)
| 항목 | 결정 |
|------|------|
| 배포 타겟 | AWS Lightsail VPS (x86/amd64, 이미 인스턴스 생성됨) |
| 공개 방식 | 내부 IP:포트(`3000`)만. 도메인·HTTPS·reverse proxy 없음 |
| 배포 트리거 | 방식 A: ghcr 푸시 + SSH pull (`docker compose pull && up -d`) |
| 레지스트리 | `ghcr.io` (private, 워크플로우 `GITHUB_TOKEN`으로 푸시) |
| 품질 게이트 | 배포 전 `pnpm lint && typecheck && test` 강제 (실패 시 배포 중단) |
| 베이스 이미지 | `node:24-alpine` (로컬 Node 24와 통일) |

### 범위 밖 (YAGNI)
- 도메인 연결, HTTPS/TLS, reverse proxy(Nginx/Caddy/Traefik)
- 무중단 블루-그린/카나리 배포 (단일 컨테이너 `up -d` 재시작으로 충분)
- 멀티 아키텍처 빌드 (Lightsail amd64 단일 타겟)
- Vercel 프로젝트 정리/삭제 (이전 검증 후 사용자가 별도 판단)

---

## 2. 환경변수 분류 (핵심)

| 변수 | 시점 | 처리 방식 | 비고 |
|------|------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | **빌드타임** | Dockerfile `ARG` → 번들 인라인 | publishable, 노출 무방 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **빌드타임** | Dockerfile `ARG` → 번들 인라인 | publishable, 노출 무방 |
| `RIOT_API_KEY` | **런타임** | 컨테이너 실행 시 주입 (서버 `.env`) | 시크릿. 이미지에 박지 않음 |

> `NEXT_PUBLIC_*`는 `next build` 시점에 클라이언트 번들에 문자열로 박힌다.
> 런타임 주입으로는 바꿀 수 없으므로 **반드시 빌드 ARG로 전달**한다.
> `RIOT_API_KEY`는 서버 사이드(API route)에서만 쓰이므로 런타임 env로 주입한다.

---

## 3. 산출물 (생성/수정 파일)

### 3.1 `next.config.ts` (수정)
```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',   // 추가: 최소 실행본(.next/standalone) 생성
}
```

### 3.2 `Dockerfile` (신규, 멀티스테이지)
- **stage `deps`**: `node:24-alpine` + corepack(pnpm) → `pnpm install --frozen-lockfile`
- **stage `build`**:
  - `ARG NEXT_PUBLIC_SUPABASE_URL`, `ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - 해당 ARG를 `ENV`로 노출 후 `pnpm build`
  - 출력: `.next/standalone`, `.next/static`, `public`
- **stage `runner`**:
  - `node:24-alpine`, `NODE_ENV=production`
  - non-root 유저(`node`) 사용
  - standalone 결과물 + `.next/static` + `public` 복사
  - `EXPOSE 3000`, `CMD ["node", "server.js"]`
  - `RIOT_API_KEY`는 복사/박지 않음 (런타임 주입)

### 3.3 `.dockerignore` (신규)
제외 대상: `node_modules`, `.next`, `.git`, `.github`, `docs`, `tests`, `raw-data`,
`actual-data`, `.bkit`, `.claude`, `.superpowers`, `.understand-anything`,
`.playwright-mcp`, `*.tsbuildinfo`, `.env*`

### 3.4 `docker-compose.yml` (신규, 서버 배치용 — 레포에도 보관)
```yaml
services:
  app:
    image: ghcr.io/keyy1315/tft_sim:latest
    ports:
      - "3000:3000"
    environment:
      - RIOT_API_KEY=${RIOT_API_KEY}
      - NODE_ENV=production
    restart: unless-stopped
```
- 서버에는 `RIOT_API_KEY=...`만 담은 `.env`를 같은 디렉토리에 둔다.

### 3.5 `.github/workflows/deploy.yml` (신규)
**잡 1 — `quality`** (게이트):
- checkout → pnpm 셋업 → `pnpm install --frozen-lockfile`
- `pnpm lint` → `pnpm typecheck` → `pnpm test`
- 하나라도 실패 시 워크플로우 종료 (이후 잡 미실행)

**잡 2 — `build-push`** (`needs: quality`):
- ghcr 로그인 (`docker/login-action`, `GITHUB_TOKEN`)
- `docker/build-push-action`:
  - `build-args`로 `NEXT_PUBLIC_*` 두 개 전달 (Actions Secrets에서)
  - 태그: `:latest` + `:${{ github.sha }}`
  - 캐시: `cache-from/to: type=gha`

**잡 3 — `deploy`** (`needs: build-push`):
- `appleboy/ssh-action`으로 Lightsail 접속
- 배포 디렉토리에서:
  ```
  echo $GHCR_TOKEN | docker login ghcr.io -u keyy1315 --password-stdin
  docker compose pull
  docker compose up -d
  docker image prune -f
  ```

트리거: `on: push: branches: [main]` + `workflow_dispatch` (수동 재배포용)

---

## 4. GitHub Secrets

| Secret | 용도 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 빌드 ARG |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 빌드 ARG |
| `LIGHTSAIL_HOST` | SSH 대상 IP (Lightsail 고정 IP 권장) |
| `LIGHTSAIL_USER` | SSH 계정 (Ubuntu 이미지면 `ubuntu`) |
| `LIGHTSAIL_SSH_KEY` | SSH 개인키 (Lightsail 키페어) |
| `GHCR_PULL_TOKEN` | 서버에서 private 이미지 pull용 PAT (`read:packages`) |

> ghcr **푸시**는 워크플로우 기본 `GITHUB_TOKEN`으로 가능(별도 토큰 불필요).
> 서버 **pull**은 별도 세션이라 `read:packages` 스코프 PAT가 필요하다.

---

## 5. Lightsail 1회성 셋업 가이드 (문서로 남김)

1. **인스턴스 OS 확인**: Ubuntu LTS 가정 (SSH 유저 `ubuntu`)
2. **고정 IP 할당**: Lightsail → Networking → Static IP 연결 (재부팅 시 IP 변경 방지)
3. **방화벽**: Lightsail → Networking → IPv4 Firewall → Custom TCP **3000** 허용
   (가능하면 접속 소스 IP 제한)
4. **Docker + Compose 설치**: `get.docker.com` 스크립트 → `ubuntu` 유저 docker 그룹 추가
5. **배포 디렉토리 준비**: 예) `~/app/` 에 `docker-compose.yml` 배치 + `.env`(RIOT_API_KEY) 생성
6. **ghcr 로그인**: `GHCR_PULL_TOKEN`으로 `docker login ghcr.io`
7. **SSH 키**: Actions가 쓸 키페어를 `authorized_keys`에 등록, 개인키는 `LIGHTSAIL_SSH_KEY` 시크릿에

---

## 6. 데이터 흐름 / 컴포넌트 경계

```
[개발자] --push main--> [GitHub]
                           |
                  (1) quality 잡: lint/typecheck/test
                           | pass
                  (2) build-push 잡
                     - NEXT_PUBLIC_* ARG 주입하여 build
                     - ghcr.io/keyy1315/tft_sim:{latest,sha} push
                           |
                  (3) deploy 잡: SSH --> [Lightsail VPS]
                                           - docker compose pull
                                           - docker compose up -d
                                           - RIOT_API_KEY는 서버 .env에서 주입
                                           |
                                    [컨테이너 :3000] <-- 사용자 (IP:3000)
```

- **빌드 책임**: GitHub Actions (서버는 빌드 안 함 → Lightsail 부하 최소)
- **시크릿 경계**: 빌드 시크릿(Supabase)은 Actions, 런타임 시크릿(Riot)은 서버 `.env`로 분리
- **롤백**: `docker-compose.yml`의 태그를 `:latest` → `:<이전 sha>`로 바꿔 `up -d`

---

## 7. 검증 시나리오 (구현 후 확인 항목)

1. 로컬에서 `docker build` 성공 + `docker run -p 3000:3000` 후 페이지 정상 렌더
2. 빌드된 번들에 Supabase URL이 인라인됐는지(클라이언트 동작), `RIOT_API_KEY`는 이미지에 없음 확인
3. main 푸시 → Actions 3개 잡 순차 통과(quality → build-push → deploy)
4. Lightsail에서 `docker ps`로 컨테이너 running, IP:3000 외부 접속 확인
5. lint/typecheck/test 중 하나를 일부러 깨뜨려 배포가 중단되는지 확인(게이트 동작)

---

## 8. 리스크 / 주의

- **NEXT_PUBLIC 누락**: build-args 전달을 빠뜨리면 런타임에 Supabase 연결 실패(빌드 후엔 못 고침). 검증 2번으로 차단.
- **ghcr private pull 실패**: 서버에 `read:packages` PAT 로그인 누락 시 `pull` 실패. 셋업 6번으로 차단.
- **포트 방화벽**: Lightsail 방화벽(콘솔)과 OS 방화벽(ufw) 둘 다 확인 필요.
- **아키텍처**: Lightsail amd64 가정. 혹시 ARM 인스턴스라면 build-push에 `platforms: linux/arm64` 필요(현재 범위 밖).
- **Vercel 중복 배포**: 이전 완료 전까지 Vercel 연동을 끄지 않으면 양쪽 배포. 검증 후 Vercel 측 정리.
