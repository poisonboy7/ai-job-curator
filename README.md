![웹프론트](AI%20Job%20Curation.png)


# 🚀 AI 맞춤형 채용 큐레이션 서비스 구축 가이드

이 프로젝트는 사용자의 이력서를 AI가 분석하여, 매일 아침 가장 적합한 채용 공고를 메일로 큐레이션해 주는 완전 자동화 시스템입니다. 누구나 순서대로 따라 하면 내 컴퓨터에 똑같은 시스템을 구축할 수 있습니다.

---

## 🛠 0. 필수 준비물
- 컴퓨터 (Windows / Mac / Linux)
- 인터넷 연결

---

## 🐋 1. Docker (도커) 설치
모든 시스템을 하나로 묶어주는 튼튼한 컨테이너입니다.
1. [Docker Desktop 공식 홈페이지](https://www.docker.com/products/docker-desktop/)에 접속합니다.
2. 다운로드 후 설치 버튼만 계속 눌러서 설치합니다. (Windows의 경우 WSL2 설치 안내가 나오면 허용해 줍니다.)
3. 설치 후 **Docker Desktop 프로그램**을 더블클릭해서 켜둡니다. (고래 모양 아이콘이 초록색이 되면 준비 완료)

---

## 🦙 2. Ollama (로컬 AI 모델) 설치
내 컴퓨터 안에서 돌아가는 무료 AI 두뇌입니다.
1. [Ollama 공식 홈페이지](https://ollama.com/)에서 다운로드 후 설치합니다.
2. 터미널(Windows는 명령 프롬프트 cmd)을 열고 아래 명령어를 칩니다.
   ```bash
   ollama run gemma2:9b
   ```
   *(gemma2:9b 대신 본인이 원하는 모델을 써도 됩니다.)*
3. 다운로드가 끝나고 AI가 대답을 시작하면 설치 완료입니다. 창을 그대로 켜둡니다.

---

## 🧠 3. Dify (AI 프롬프트 제작소) 설치 및 세팅
이력서를 분석할 AI 작업장입니다.
1. 터미널을 열고 코드를 다운받아 실행합니다.
   ```bash
   git clone https://github.com/langgenius/dify.git
   cd dify/docker
   cp .env.example .env
   docker-compose up -d
   ```
2. 인터넷 창을 열고 `http://localhost/install` 로 접속해 관리자 계정을 만듭니다.
3. 상단 메뉴에서 **[스튜디오] -> [앱 가져오기(Import)]**를 누릅니다.
4. 폴더에 있는 **`Resume-Analyzer.yml`** 파일을 끌어다 놓습니다.
5. 우측 상단 모델 설정에서 방금 깐 Ollama를 연결합니다.
   - Base URL: `http://host.docker.internal:11434`
6. 앱을 발행(Publish)하고 **API 키**를 복사해 메모장에 적어둡니다.

---

## ⚙️ 4. Activepieces (자동화 로봇) 설치 및 세팅
AI와 크롤러, 이메일을 하나로 이어주는 공장 레일입니다.
1. 터미널을 새로 열고 아래 명령어를 칩니다.
   ```bash
   git clone https://github.com/activepieces/activepieces.git
   cd activepieces
   docker-compose up -d
   ```
2. 인터넷 창을 열고 `http://localhost:8080` 에 접속해 계정을 만듭니다.
3. 왼쪽 메뉴 **[Flows]**로 가서 **[Import Flow]**를 누릅니다.
4. 폴더에 있는 JSON 파일 2개를 차례대로 불러옵니다.
   - `1. 이력서 수신 및 구독 조건 등록.json`
   - `2. 매일 아침 8시 맞춤 채용정보 메일 발송.json`
5. 1번 플로우에서 **Send HTTP request** 노드를 클릭하고, 헤더에 아까 메모해 둔 Dify API 키를 넣습니다. (`Bearer 내키`)
6. 맨 위 **Catch Webhook**을 누르고 생성된 URL 주소를 메모장에 적어둡니다.
7. 2번 플로우에서 **Send Email (Gmail)** 노드를 클릭해 본인의 구글 계정을 연동해 줍니다.
8. 두 플로우 모두 우측 상단의 **[Publish]** 버튼을 눌러 활성화합니다.

---

## 🌐 5. ngrok (터널 뚫기) 설치 및 세팅
내 컴퓨터(localhost)를 바깥세상(Vercel)과 연결해 주는 비밀 통로입니다.
1. [ngrok 홈페이지](https://ngrok.com/)에 회원가입하고 프로그램을 다운로드합니다.
2. 홈페이지 대시보드에 나오는 `authtoken` 명령어를 복사해서 터미널에 붙여넣습니다.
   ```bash
   ngrok authtoken 본인_토큰문자열
   ```
3. 아래 명령어를 쳐서 Activepieces(8080 포트 or 셋팅한 포트 번호)와 연결된 터널을 엽니다.
   ```bash
   ngrok http 8080
   ```
4. 검은 화면에 `Forwarding  https://abcd-123.ngrok-free.app -> http://localhost:8080` 같은 주소가 뜹니다.
5. 이 **https://~** 주소가 외부에서 접속할 수 있는 내 Activepieces 웹훅 주소의 앞부분이 됩니다.

---

## 🚀 6. Vercel (사용자용 웹사이트) 배포 및 사용
고객이 이력서를 올릴 수 있는 예쁜 웹페이지를 인터넷에 올립니다.
1. 터미널을 열고 프로젝트 폴더에서 아래 명령어를 칩니다. (Node.js가 안 깔려있다면 먼저 설치하세요)
   ```bash
   npm install -g vercel
   vercel
   ```
2. 계속 Enter를 눌러서 1차 배포를 끝냅니다.
3. [Vercel 홈페이지](https://vercel.com)에 로그인 후, 방금 만든 프로젝트로 들어갑니다.
4. **[웹훅 주소(환경변수) 등록]**: 
   - Settings -> Environment Variables 메뉴로 이동
   - Key 칸에 `WEBHOOK_URL` 입력, Value 칸에 **방금 ngrok으로 만든 웹훅 주소** 입력 후 Save
   - 상단 메뉴의 'Deployments' -> 점 3개 버튼 -> 'Redeploy'를 눌러 재배포 (적용을 위해 필수!)
5. **[과잉 보안 장치 끄기]**: 
   - Settings -> Security(또는 Deployment Protection) -> Vercel Authentication 항목 전체 끄기(OFF) 후 Save
6. 마지막에 나오는 `https://[프로젝트명].vercel.app` 링크가 서비스 주소입니다! 접속해서 테스트해 보세요! 🎉
