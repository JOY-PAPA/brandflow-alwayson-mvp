# BrandFlow Always-On MVP

브랜드 콘텐츠를 한 번 기획하고 Instagram, 네이버 블로그, Google Blogger, Threads, YouTube Shorts의 문법에 맞게 변환한 뒤 검수·예약·발행 상태를 관리하는 로컬 실행형 MVP입니다.

## 지금 바로 확인할 수 있는 것

- 마스터 브리프 1건에서 5채널 초안 생성
- Instagram 6장 캐러셀, 네이버 장문, Blogger 아티클, Threads 대화형 글, YouTube Shorts 스크립트로 분기
- 브랜드 적합도·명료성·독창성·표현 위험 점검
- 사람의 검수 승인 없이는 예약 불가
- 채널별 독립 작업 큐, 예약 시각, 발행 중·완료·재시도·실패 상태
- 네이버 블로그는 공식 글쓰기 API 종료를 반영해 `수동 게시 대기`로 안전하게 전환
- 채널 성과 신호, 추천 발행 시간, 다음 행동 제안 UI
- 데스크톱·모바일 반응형 대시보드

현재 버전은 `dry-run`입니다. 실제 SNS 계정에 게시하지 않으며, 자격증명 없이 전체 운영 흐름을 검증합니다.

## 실행 방법

Node.js 22 이상이 필요합니다. 외부 패키지는 필요하지 않습니다.

```powershell
cd brandflow-alwayson-mvp
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

테스트:

```powershell
npm test
```

## GitHub Pages 배포판

GitHub Pages는 서버 프로그램을 실행할 수 없으므로 `docs/`에는 브라우저 저장소 기반의 정적 데모가 들어 있습니다. 다음 명령으로 다시 생성할 수 있습니다.

```powershell
npm run build:pages
```

Pages 설정에서는 `Deploy from a branch`, 브랜치 `main`, 폴더 `/docs`를 선택합니다. 공개된 데모에서 생성·승인·예약 상태는 방문자의 브라우저에만 저장되며 실제 SNS 계정에는 게시되지 않습니다. 페이지가 열려 있을 때만 15초 주기 작업 확인이 동작합니다.

## 빠른 사용 흐름

1. `새 콘텐츠`를 눌러 주제, 고객, 목표, 키워드를 입력합니다.
2. 다섯 채널의 초안을 비교합니다.
3. `검수 승인`을 누릅니다.
4. 발행 채널과 시각을 정해 예약합니다.
5. 발행 큐에서 `지금 실행`으로 데모 상태 전이를 확인합니다.
6. Instagram 등 공식 API 채널은 `발행 완료`, 네이버는 `수동 게시 대기`가 됩니다.

## 구조

```text
brandflow-alwayson-mvp/
├─ public/              대시보드 UI
├─ src/
│  ├─ engine.js         생성·승인·예약·재시도 상태 머신
│  ├─ adapters.js       채널 기능 경계와 드라이런 게시기
│  ├─ seed.js           데모 브랜드·콘텐츠·지표
│  └─ store.js          JSON 파일/메모리 저장소
├─ test/engine.test.js  핵심 도메인 테스트
├─ server.js            Node.js HTTP API와 정적 파일 서버
└─ ANALYSIS_AND_BUILD_PLAN.md
```

## 생산 환경으로 전환하기 전에 필요한 것

- 조직·브랜드·권한·감사 로그를 포함한 PostgreSQL 데이터 모델
- Redis 기반 지연 작업 큐와 워커 분리
- OAuth 토큰 암호화·회전·폐기, 비밀 저장소
- Meta App Review, Google OAuth 동의 화면 및 YouTube API 감사
- 공개 미디어 저장소와 이미지·영상 렌더러
- 실제 플랫폼 인사이트 수집기와 UTM/전환 데이터 결합
- 광고·의료·금융 등 업종별 금칙어와 법무 승인 규칙
- LLM 공급자 연결, 근거 인용, 프롬프트 버전 관리, 비용 한도

네이버 블로그 자동 게시를 위해 비공식 브라우저 조작이나 계정 공유를 기본 설계에 넣지 않았습니다. 공식 정책과 계정 안정성을 우선하며, 현재는 검수 가능한 원고·HTML·이미지 패키지 내보내기가 안전한 경계입니다.
