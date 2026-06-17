# Docker + GitHub Actions 배포 (1단계: ghcr) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` 푸시 시 GitHub Actions가 lint·typecheck·test를 통과한 뒤 Next.js 앱을 Docker 이미지로 빌드해 `ghcr.io`에 푸시하고, SSH로 Lightsail에 접속해 컨테이너를 pull·재시작하는 자동 배포 파이프라인을 구축한다.

**Architecture:** Next.js `output: 'standalone'` + 멀티스테이지 Dockerfile로 경량 이미지 생성. `NEXT_PUBLIC_*`(Supabase)는 빌드 ARG, `RIOT_API_KEY`는 서버 런타임 env로 분리. GitHub Actions 3-잡(quality → build-push → deploy) 파이프라인. 내부 IP:3000 노출, HTTPS/도메인 없음.

**Tech Stack:** Next.js 16, Node 24(alpine), pnpm 10, Docker 멀티스테이지, GitHub Actions, ghcr.io, AWS Lightsail(amd64), docker compose.

**Spec:** `docs/superpowers/specs/2026-06-17-docker-github-actions-deploy-design.md`

**전제:** 로컬에 Docker Desktop이 설치·실행 중이어야 한다(`docker --version` 확인). 레포 이미지 경로는 `ghcr.io/keyy1315/tft_sim`(소문자).

---

## Task 1: Next.js standalone 출력 활성화

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: `next.config.ts`에 `output: 'standalone'` 추가**

현재 내용:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}

export default nextConfig
```

다음으로 변경:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 2: 빌드 실행해 standalone 산출물이 생기는지 검증**

Run: `pnpm build`
Expected: 빌드 성공. 종료 후 다음 경로가 존재해야 한다.

Run: `ls .next/standalone/server.js && ls -d .next/standalone/.next .next/static`
Expected: `server.js`와 두 디렉토리 경로가 출력됨(에러 없음). 없으면 standalone 설정이 적용되지 않은 것.

- [ ] **Step 3: typecheck 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없이 종료(exit 0).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(deploy): Next.js standalone 출력 활성화"
```

---

## Task 2: `.dockerignore` 작성

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: `.dockerignore` 생성**

빌드 컨텍스트에서 불필요/민감 파일을 제외한다. `.env*`를 제외해 시크릿이 이미지에 안 들어가게 한다.

```
# deps & build artifacts
node_modules
.next
*.tsbuildinfo

# vcs & ci
.git
.github
.githooks

# env / secrets
.env
.env.*
!.env.example

# docs & data & tests (런타임 불필요)
docs
tests
raw-data
actual-data
scripts

# tooling caches
.bkit
.claude
.superpowers
.understand-anything
.playwright-mcp

# os
.DS_Store
```

- [ ] **Step 2: 무시 규칙이 올바른지 확인**

Run: `git check-ignore -v node_modules .env docs 2>/dev/null; echo "---"; test -f .dockerignore && echo ".dockerignore exists"`
Expected: 마지막 줄에 `.dockerignore exists` 출력(파일 생성 확인). (`git check-ignore`는 `.gitignore` 기준이라 참고용일 뿐 — 핵심은 파일 존재.)

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "feat(deploy): .dockerignore 추가"
```

---

## Task 3: `Dockerfile` 작성 및 로컬 빌드·실행 검증

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: `Dockerfile` 생성 (멀티스테이지)**

```dockerfile
# syntax=docker/dockerfile:1

# ---- deps: 의존성 설치 (lockfile 기반) ----
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: NEXT_PUBLIC ARG 주입 후 빌드 ----
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- runner: standalone 산출물만 복사한 경량 실행 이미지 ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

> 주의: `RIOT_API_KEY`는 의도적으로 빌드에 넣지 않는다(런타임 주입). `NEXT_PUBLIC_*`만 빌드 ARG.

- [ ] **Step 2: 로컬 빌드 (NEXT_PUBLIC 값은 `.env`에서 주입)**

Run:
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-)" \
  -t tft_sim:local .
```
Expected: 빌드가 끝까지 성공(`naming to docker.io/library/tft_sim:local` 또는 `writing image ... done`). build 스테이지에서 `pnpm build`가 통과해야 함.

- [ ] **Step 3: 컨테이너 실행 후 응답 검증**

Run:
```bash
docker run -d --rm --name tft_local -p 3000:3000 \
  -e RIOT_API_KEY="$(grep '^RIOT_API_KEY=' .env | cut -d= -f2-)" \
  tft_sim:local
sleep 3
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000
```
Expected: `200` 출력. (앱 첫 페이지 HTTP 200.)

- [ ] **Step 4: 이미지에 Riot 키가 박히지 않았는지 확인**

Run:
```bash
docker run --rm --entrypoint sh tft_sim:local -c "grep -rl 'RIOT_API_KEY' / 2>/dev/null | head; echo done"
```
Expected: 마지막 줄 `done`만 보이거나, 코드 파일(소스에 등장하는 변수명)만 잡히고 **실제 키 값 문자열은 없음**. (확인 보조용 — 핵심은 Dockerfile에 `RIOT_API_KEY` ARG/ENV가 없다는 점.)

- [ ] **Step 5: 컨테이너 정리**

Run: `docker stop tft_local`
Expected: `tft_local` 출력(중지됨, `--rm`이라 자동 삭제).

- [ ] **Step 6: Commit**

```bash
git add Dockerfile
git commit -m "feat(deploy): 멀티스테이지 Dockerfile 추가 (standalone 런타임)"
```

---

## Task 4: `docker-compose.yml` 작성

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: `docker-compose.yml` 생성 (서버 실행 정의)**

서버에 배치되며 레포에도 보관한다. 런타임 시크릿은 서버의 `.env`에서 주입.

```yaml
services:
  app:
    image: ghcr.io/keyy1315/tft_sim:latest
    container_name: tft_sim
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - RIOT_API_KEY=${RIOT_API_KEY}
    restart: unless-stopped
```

- [ ] **Step 2: compose 파일 문법 검증**

Run: `docker compose -f docker-compose.yml config -q && echo "compose ok"`
Expected: `compose ok` 출력. (`${RIOT_API_KEY}` 미설정 경고가 떠도 문법 검증은 통과.)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(deploy): 서버용 docker-compose.yml 추가"
```

---

## Task 5: GitHub Actions 워크플로우 작성

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: `.github/workflows/deploy.yml` 생성**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  IMAGE: ghcr.io/keyy1315/tft_sim

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  build-push:
    needs: quality
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE }}:latest
            ${{ env.IMAGE }}:${{ github.sha }}
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy to Lightsail
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            cd ~/app
            echo "${{ secrets.GHCR_PULL_TOKEN }}" | docker login ghcr.io -u keyy1315 --password-stdin
            docker compose pull
            docker compose up -d
            docker image prune -f
```

- [ ] **Step 2: 워크플로우 YAML 문법 검증 (로컬)**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: `yaml ok` 출력.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(deploy): GitHub Actions 파이프라인(quality→build-push→deploy)"
```

---

## Task 6: Lightsail 셋업 + Secrets 운영 문서

**Files:**
- Create: `docs/deploy/lightsail-setup.md`

- [ ] **Step 1: `docs/deploy/lightsail-setup.md` 생성**

````markdown
# Lightsail 배포 셋업 (1단계: ghcr)

자동 배포 파이프라인이 동작하려면 **GitHub Secrets 등록**과 **서버 1회 셋업**이 필요하다.

## 1. GitHub Secrets (레포 Settings → Secrets and variables → Actions)

| Secret | 값 | 용도 |
|--------|----|----|
| `NEXT_PUBLIC_SUPABASE_URL` | 로컬 `.env`와 동일 | 빌드 ARG |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 로컬 `.env`와 동일 | 빌드 ARG |
| `LIGHTSAIL_HOST` | Lightsail 고정 IP | SSH 대상 |
| `LIGHTSAIL_USER` | `ubuntu` (Ubuntu 이미지) | SSH 계정 |
| `LIGHTSAIL_SSH_KEY` | SSH 개인키 전체 내용 | SSH 인증 |
| `GHCR_PULL_TOKEN` | `read:packages` 스코프 PAT | 서버에서 private 이미지 pull |

> ghcr **푸시**는 워크플로우 기본 `GITHUB_TOKEN`으로 처리되어 별도 토큰이 필요 없다.
> 서버 **pull**은 별도 세션이라 `GHCR_PULL_TOKEN`(PAT)이 필요하다.

## 2. Lightsail 인스턴스 셋업 (1회)

```bash
# (1) 고정 IP: Lightsail 콘솔 → Networking → Static IP 생성·연결
# (2) 방화벽: Lightsail 콘솔 → Networking → IPv4 Firewall → Custom TCP 3000 허용
#     (가능하면 소스 IP를 본인 IP로 제한)

# (3) 서버 접속 후 Docker 설치
ssh ubuntu@<LIGHTSAIL_IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# 재로그인하여 docker 그룹 적용
exit && ssh ubuntu@<LIGHTSAIL_IP>
docker --version && docker compose version

# (4) 배포 디렉토리 + compose 파일 + 런타임 .env
mkdir -p ~/app && cd ~/app
# 레포의 docker-compose.yml 내용을 그대로 배치
#   (scp 또는 직접 편집기로 작성)
printf 'RIOT_API_KEY=<실제_키>\n' > .env
chmod 600 .env

# (5) ghcr 로그인 (private 이미지 pull용)
echo "<GHCR_PULL_TOKEN>" | docker login ghcr.io -u keyy1315 --password-stdin
```

## 3. Actions가 쓸 SSH 키 등록

```bash
# 로컬에서 배포 전용 키페어 생성 (이미 Lightsail 키페어가 있으면 그걸 사용)
ssh-keygen -t ed25519 -f ~/.ssh/lightsail_deploy -N ""
# 공개키를 서버 authorized_keys에 추가
ssh-copy-id -i ~/.ssh/lightsail_deploy.pub ubuntu@<LIGHTSAIL_IP>
# 개인키(~/.ssh/lightsail_deploy 전체 내용)를 LIGHTSAIL_SSH_KEY 시크릿에 등록
```

## 4. 첫 배포 & 검증

```bash
# main에 푸시하면 파이프라인 자동 실행 (또는 Actions 탭에서 workflow_dispatch 수동 실행)
# 서버에서 확인:
ssh ubuntu@<LIGHTSAIL_IP>
docker ps                       # tft_sim 컨테이너 Up 상태
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000   # 200
# 외부에서: 브라우저로 http://<LIGHTSAIL_IP>:3000 접속
```

## 5. 롤백

```bash
# 특정 커밋 이미지로 되돌리기
cd ~/app
# docker-compose.yml의 image 태그를 :latest → :<이전_git_sha>로 수정 후
docker compose up -d
```

## 6. Vercel 정리 (이전 검증 후)

Lightsail 배포가 안정적으로 확인되면 Vercel 프로젝트의 Git 연동(자동 배포)을
끄거나 프로젝트를 보관 처리한다. 양쪽 동시 배포 방지.
````

- [ ] **Step 2: 문서 링크 무결성 가벼운 확인**

Run: `test -f docs/deploy/lightsail-setup.md && grep -c 'GHCR_PULL_TOKEN' docs/deploy/lightsail-setup.md`
Expected: `2` 이상(Secrets 표 + 셋업 명령에 등장).

- [ ] **Step 3: Commit**

```bash
git add docs/deploy/lightsail-setup.md
git commit -m "docs(deploy): Lightsail 셋업 + Secrets 운영 가이드"
```

---

## Task 7: README에 배포 섹션 링크 추가

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 끝에 배포 안내 섹션 추가**

`README.md` 맨 끝에 다음을 추가:

```markdown

## 배포 (Docker + GitHub Actions)

`main` 푸시 시 GitHub Actions가 lint·typecheck·test → 이미지 빌드(ghcr) →
Lightsail SSH 배포를 자동 수행한다.

- 설계: `docs/superpowers/specs/2026-06-17-docker-github-actions-deploy-design.md`
- 셋업/Secrets: `docs/deploy/lightsail-setup.md`

로컬 컨테이너 실행:
\`\`\`bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..." \
  -t tft_sim:local .
docker run --rm -p 3000:3000 -e RIOT_API_KEY="..." tft_sim:local
\`\`\`
```

- [ ] **Step 2: 변경 확인**

Run: `grep -c '배포 (Docker' README.md`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README에 배포 섹션 추가"
```

---

## 완료 기준 (전체 검증)

1. `pnpm build` 후 `.next/standalone/server.js` 존재 (Task 1)
2. 로컬 `docker build` 성공 + `docker run` 후 `curl localhost:3000` → 200 (Task 3)
3. `.github/workflows/deploy.yml` YAML 유효 (Task 5)
4. GitHub Secrets 6종 등록 + Lightsail 1회 셋업 완료 (Task 6, 수동)
5. `main` 푸시 → Actions 3잡(quality→build-push→deploy) 순차 통과
6. `http://<LIGHTSAIL_IP>:3000` 외부 접속 200
7. lint/typecheck/test 중 하나를 일부러 깨뜨리면 배포 중단(게이트 동작 확인)

> 주의: 5~7은 GitHub Secrets/서버 셋업(Task 6)이 끝나야 검증 가능. 코드 산출물(Task 1~5, 7)은 로컬에서 독립 검증된다.
