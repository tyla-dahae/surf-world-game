# SURF WORLD WebSocket 배포 파일

## 파일 구조

- `server.js`: 웹페이지와 WebSocket 멀티플레이 서버
- `package.json`: Node.js 실행 설정 및 `ws` 의존성
- `public/index.html`: 기존 Three.js 게임 + WebSocket 어댑터

## GitHub 웹사이트로 올리기 (간단한 방법)

1. GitHub에서 `New repository`를 눌러 새 저장소를 만듭니다. 예: `surf-world-web`.
2. 저장소에서 `Add file` → `Upload files`를 선택합니다.
3. 프로젝트 폴더 안의 `server.js`, `package.json`, `README.md`를 업로드합니다.
4. `public` 폴더는 저장소에서 `Add file` → `Create new file`을 누른 뒤 파일 이름 칸에 `public/index.html`을 입력하고, `public/index.html` 파일의 전체 내용을 붙여 넣어 저장합니다. 또는 GitHub Desktop으로 프로젝트 폴더 전체를 복사해 올려도 됩니다.
5. `Commit changes`를 누릅니다.

## Render 배포

1. Render에 로그인하고 `New +` → `Web Service`를 선택합니다.
2. GitHub 계정을 연결하고 `surf-world-web` 저장소를 선택해 `Connect`를 누릅니다.
3. 설정값:
   - Runtime/Language: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Free`
   - Region: `Singapore` (도쿄 지역은 현재 선택지에 없고, Render에서 제공하는 아시아 지역은 싱가포르입니다.)
4. `Create Web Service`를 누르고 배포가 끝날 때까지 기다립니다.
5. Render가 표시한 `https://...onrender.com` 주소를 엽니다.
6. `https://...onrender.com/health`에 `{"ok":true,"service":"surf-world"}`가 나오면 서버가 실행 중입니다.

## 동시 접속 테스트

1. 게임 링크를 컴퓨터 브라우저와 핸드폰 브라우저에서 각각 엽니다.
2. 두 브라우저에서 캐릭터가 나타나고 움직임이 서로 보이는지 확인합니다.
3. 채팅, 드롭인, 투닥투닥을 테스트합니다.
4. 연결이 끊기면 클라이언트가 자동으로 다시 연결합니다. 연결이 돌아오기까지 잠깐 걸릴 수 있습니다.

## 무료 플랜 주의

Render 무료 웹 서비스는 약 15분 동안 들어오는 HTTP 요청이나 WebSocket 메시지가 없으면 잠들 수 있습니다. 다시 접속하면 기동에 약 1분 정도 걸릴 수 있습니다. 게임은 플레이 중 위치 정보를 계속 보내기 때문에 일반적인 활성 플레이 중에는 메시지가 전달되지만, 모든 플레이어가 떠나거나 브라우저가 백그라운드에서 오래 멈추면 서비스가 잠들 수 있습니다. 자동 재접속은 이런 상황에서 복구를 돕지만 즉시 실행을 보장하지는 않습니다.
