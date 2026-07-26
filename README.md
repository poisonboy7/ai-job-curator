![웹 프런트 화면](AI%20Job%20Curation.png)

# 🚀 AI 맞춤형 채용 큐레이션 서비스

이 프로젝트는 이력서를 Dify와 로컬 Ollama 모델로 분석하고, 사용자가 선택한 지역·경력·학력 조건에 맞는 채용공고를 Activepieces가 매일 이메일로 발송하는 자동화 예제입니다.

## 동작 구조

1. 사용자가 Vercel 웹사이트에서 이력서와 구독 조건을 제출합니다.
2. Vercel의 `/api/sync`가 요청을 검증한 뒤 로컬 Activepieces 웹훅으로 전달합니다.
3. Activepieces가 Dify를 호출해 이력서에서 직무와 기술 키워드를 추출하고 구독 정보를 저장합니다.
4. 매일 오전 8시 자동화가 채용 사이트를 조회하고 조건에 맞는 공고를 Gmail로 발송합니다.

### 지역 매칭 방식

- 주소 검색 결과에서 주요 시·구·군 지역명을 추출합니다.
- 채용공고 주소에 해당 지역명이 포함되는지를 기준으로 필터링합니다.
- 위도·경도 또는 직선거리 기반 반경 계산은 사용하지 않습니다.

> 이 구성은 로컬 시연·개인 테스트용입니다. ngrok과 단일 Activepieces 컨테이너 구성은 상시 운영용 프로덕션 환경으로 권장되지 않습니다.

---

## 0. 필수 준비물

- Windows, macOS 또는 Linux 컴퓨터
- 인터넷 연결
- [Git](https://git-scm.com/downloads)
- [Node.js LTS](https://nodejs.org/)와 npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 또는 Docker Engine
- ngrok, Vercel, Google 계정
- Ollama 모델과 Dify 컨테이너를 함께 실행할 수 있는 메모리와 디스크 공간

명령은 PowerShell, 터미널 또는 Git Bash에서 실행합니다. Windows 명령 프롬프트에서는 일부 Unix 명령이 동작하지 않으므로 PowerShell 사용을 권장합니다.

---

## 1. Docker 설치

1. Docker Desktop을 설치합니다.
2. Windows에서 WSL2 설치 안내가 나오면 허용합니다.
3. Docker Desktop을 실행하고 Docker 엔진이 준비될 때까지 기다립니다.
4. 터미널에서 다음 명령으로 설치를 확인합니다.

   ```bash
   docker version
   docker compose version
   ```

---

## 2. Ollama와 모델 설치

1. [Ollama 공식 홈페이지](https://ollama.com/)에서 Ollama를 설치합니다.
2. 다음 명령으로 이 프로젝트에 설정된 모델을 받습니다.

   ```bash
   ollama run gemma2:9b
   ```

3. 모델이 응답하면 `Ctrl+C`로 대화를 종료해도 됩니다. Ollama 백그라운드 서비스는 계속 실행되어야 합니다.

`Resume-Analyzer.yml`은 `gemma2:9b`를 사용하도록 설정되어 있습니다. 다른 모델을 사용하려면 Ollama에서 그 모델을 받은 뒤 Dify로 가져온 워크플로의 LLM 모델도 같은 이름으로 변경해야 합니다.

---

## 3. Dify 설치와 워크플로 가져오기

1. Dify 저장소를 내려받습니다.

   ```bash
   git clone https://github.com/langgenius/dify.git
   cd dify/docker
   ```

2. 환경 파일을 만듭니다.

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS, Linux 또는 Git Bash:

   ```bash
   cp .env.example .env
   ```

3. Docker Compose V2로 Dify를 실행합니다.

   ```bash
   docker compose up -d
   docker compose ps
   ```

4. `http://localhost/install`에 접속해 관리자 계정을 만듭니다.
5. **스튜디오 → 앱 가져오기(Import)**에서 `Resume-Analyzer.yml`을 가져옵니다.
6. Dify의 Ollama 모델 공급자를 다음 주소로 연결합니다.

   - Base URL: `http://host.docker.internal:11434`
   - Model: `gemma2:9b`

7. 워크플로를 테스트한 뒤 발행하고 새 API 키를 발급합니다.

Docker Desktop이 아닌 Linux Docker Engine에서는 `host.docker.internal`이 자동 등록되지 않을 수 있습니다. 이 경우 Dify Docker Compose의 Ollama를 호출하는 서비스에 아래 설정을 추가한 뒤 다시 실행해야 합니다.

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## 4. ngrok 주소 준비

1. [ngrok](https://ngrok.com/)에 가입하고 프로그램을 설치합니다.
2. 대시보드에 표시되는 인증 토큰을 등록합니다.

   ```bash
   ngrok config add-authtoken 본인_토큰
   ```

3. Activepieces가 사용할 8080 포트를 공개합니다.

   ```bash
   ngrok http 8080
   ```

4. 표시된 HTTPS 주소를 복사합니다. 예: `https://example.ngrok-free.app`
5. ngrok 터미널은 서비스를 사용하는 동안 계속 실행해 둡니다.

무료 ngrok 개발 도메인은 개발·테스트 용도이며 사용량과 기능에 제한이 있습니다.

---

## 5. Activepieces 설치

이 프로젝트는 개인 테스트에 맞는 단일 Docker 컨테이너 구성을 사용합니다. 아래 명령의 `AP_FRONTEND_URL`을 4단계에서 복사한 ngrok HTTPS 주소로 바꾸고 한 줄로 실행합니다.

```bash
docker run -d --name activepieces -p 8080:80 -v activepieces_data:/root/.activepieces --add-host=host.docker.internal:host-gateway -e AP_REDIS_TYPE=MEMORY -e AP_DB_TYPE=PGLITE -e AP_FRONTEND_URL="https://example.ngrok-free.app" activepieces/activepieces:latest
```

실행 상태를 확인합니다.

```bash
docker ps
```

브라우저에서 `http://localhost:8080`에 접속해 계정을 만듭니다.

상시 운영 또는 여러 인스턴스가 필요한 경우에는 Activepieces 공식 Docker Compose 구성과 PostgreSQL·Redis를 사용하세요.

---

## 6. Activepieces 플로우 설정

1. **Flows → Import Flow**에서 다음 파일을 차례대로 가져옵니다.

   - `이력서 수신 및 구독 조건 등록.json`
   - `매일 아침 8시 맞춤 채용정보 메일 발송.json`

2. 첫 번째 플로우의 **Send HTTP request** 단계를 엽니다.
3. `Authorization` 헤더의 `REPLACE_WITH_NEW_DIFY_API_KEY`를 새 Dify API 키로 교체합니다.

   ```text
   Bearer 새_DIFY_API_키
   ```

4. 요청 주소가 `http://host.docker.internal/v1/workflows/run`인지 확인합니다.
5. **Catch Webhook**에서 생성된 전체 HTTPS 웹훅 URL을 복사합니다. `AP_FRONTEND_URL`을 올바르게 설정했다면 ngrok 도메인으로 시작해야 합니다.
6. 두 번째 플로우의 **Send Email** 단계에서 본인의 Google 계정을 연결합니다.
7. 일정 트리거가 `Asia/Seoul`, 오전 `8`, 주말 실행 켜짐으로 되어 있는지 확인합니다.
8. 두 플로우를 모두 발행합니다.

배포 사이트 주소는 Vercel의 `PUBLIC_SITE_URL`이 웹훅을 통해 자동 저장됩니다. 따라서 이메일의 **내 조건 변경**과 **수신 거부** 링크를 플로우 JSON에서 직접 수정할 필요가 없습니다.

---

## 7. Vercel 배포

1. 이 프로젝트 폴더에서 Vercel CLI를 설치하고 배포합니다.

   ```bash
   npm install -g vercel
   vercel
   ```

2. Vercel 프로젝트의 **Settings → Environment Variables**에 다음 값을 등록합니다.

   | 변수 | 필수 | 값 |
   |---|---:|---|
   | `WEBHOOK_URL` | 필수 | Activepieces의 전체 Catch Webhook HTTPS URL |
   | `PUBLIC_SITE_URL` | 필수 | 최종 서비스 주소, 예: `https://프로젝트명.vercel.app` |
   | `ALLOWED_ORIGINS` | 필수 | 요청을 허용할 주소. 여러 개면 쉼표로 구분 |
   | `RATE_LIMIT_MAX` | 선택 | 기본값 `10` |
   | `RATE_LIMIT_WINDOW_MS` | 선택 | 기본값 `60000` |
   | `MAX_BODY_BYTES` | 선택 | 기본값 `4500000` |

3. 환경변수 저장 후 **Deployments → Redeploy**로 다시 배포합니다.
4. 서비스가 공개되어야 한다면 Deployment Protection에서 해당 프로덕션 배포의 공개 접속을 허용합니다. 다른 보안 설정까지 일괄 해제하지 마세요.

`PUBLIC_SITE_URL`과 `ALLOWED_ORIGINS`에는 끝의 `/` 없이 정확한 HTTPS 주소를 넣는 것을 권장합니다.

---

## 8. 최종 확인

1. Vercel 사이트에서 이력서와 구독 조건을 제출합니다.
2. 브라우저 개발자 도구에서 요청이 `/api/sync`로 전송되는지 확인합니다.
3. Activepieces의 첫 번째 플로우 실행 이력에서 성공 여부를 확인합니다.
4. 두 번째 플로우를 수동 실행해 테스트 이메일을 받습니다.
5. 이메일의 **내 조건 변경**과 **수신 거부** 링크가 `PUBLIC_SITE_URL`로 연결되는지 확인합니다.

---

## 보안 주의사항

- 저장소의 자동화 JSON에는 실제 Dify API 키가 없습니다. 가져온 플로우 안에서 새 키를 입력하세요.
- 과거 공개된 Dify API 키는 반드시 폐기하고 새로 발급하세요.
- `.env`, ngrok 인증 토큰, Gmail 연결 정보는 커밋하지 마세요.
- `WEBHOOK_URL`은 브라우저 코드에 넣지 말고 Vercel 환경변수로만 관리하세요.
- `ALLOWED_ORIGINS`에는 신뢰하는 실제 배포 주소만 등록하세요.
- 현재 요청 제한은 서버리스 인스턴스 메모리 기반 보조 장치입니다. 공개 서비스 규모가 커지면 Vercel Firewall이나 외부 저장소 기반 제한을 사용하세요.
- 채용 사이트 HTML 구조가 바뀌면 크롤러가 결과를 가져오지 못할 수 있으므로 Activepieces 실행 기록을 정기적으로 확인하세요.
