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
#     (가능하면 접속 소스 IP를 본인 IP로 제한)

# (3) 서버 접속 후 Docker 설치
ssh ubuntu@<LIGHTSAIL_IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# 재로그인하여 docker 그룹 적용
exit && ssh ubuntu@<LIGHTSAIL_IP>
docker --version && docker compose version

# (4) 배포 디렉토리 + compose 파일 + 런타임 .env
mkdir -p ~/app && cd ~/app
# 레포의 docker-compose.yml 내용을 그대로 배치 (scp 또는 편집기로 작성)
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
cd ~/app
# docker-compose.yml의 image 태그를 :latest → :<이전_git_sha>로 수정 후
docker compose up -d
```

## 6. Vercel 정리 (이전 검증 후)

Lightsail 배포가 안정적으로 확인되면 Vercel 프로젝트의 Git 연동(자동 배포)을
끄거나 프로젝트를 보관 처리한다. 양쪽 동시 배포 방지.
