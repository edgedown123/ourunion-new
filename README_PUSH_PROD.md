# 우리노동조합 - 실전용 PWA 푸시 알림 설정 가이드 (전체게시판 / A안)

이 패치는 **앱이 꺼져 있어도** 새 게시글이 등록되면 **푸시 알림**이 오도록 구성합니다.
(안드로이드 크롬/PWA 설치 기준)

---

## 1) 프로젝트 환경변수 추가 (Vite)

`.env` 파일(또는 배포 환경 변수)에 아래를 추가하세요.

- `VITE_VAPID_PUBLIC_KEY` : 아래 2)에서 생성한 VAPID 공개키

예)
VITE_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY

---

## 2) VAPID 키 생성

아래 중 하나로 생성하세요.

### 방법 A: Node.js로 생성 (추천)
터미널에서:
`npx web-push generate-vapid-keys`

출력된
- publicKey  -> `VITE_VAPID_PUBLIC_KEY` (프론트)
- privateKey -> Supabase Edge Function secret `VAPID_PRIVATE_KEY`

---

## 3) Supabase SQL 실행 (구독 저장 테이블)

Supabase Dashboard → SQL Editor에서 실행:
`supabase/migrations/20260202_push_subscriptions.sql`

---

## 4) Supabase Edge Function 배포

### 4-1) Supabase CLI 설치/로그인
`npm i -g supabase`
`supabase login`

### 4-2) 프로젝트 루트에서 연결
`supabase link --project-ref <프로젝트REF>`

### 4-3) 함수 배포
`supabase functions deploy notify-new-post`

### 4-4) 함수 시크릿 등록
아래 시크릿을 등록하세요:

- SUPABASE_URL (대부분 자동)
- SUPABASE_SERVICE_ROLE_KEY (Supabase Settings → API)
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT (예: mailto:admin@ourunion.kr)

예)
`supabase secrets set VAPID_PUBLIC_KEY=...`
`supabase secrets set VAPID_PRIVATE_KEY=...`
`supabase secrets set VAPID_SUBJECT=mailto:admin@ourunion.kr`
`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`

---

## 5) "새 게시글 등록" 이벤트를 함수 호출로 연결 (Database Webhook)

Supabase Dashboard → Database → Webhooks(또는 Integrations)에서:

- Table: `public.posts`
- Event: `INSERT`
- URL: (배포된 Edge Function URL)
  - 예: `https://<project-ref>.functions.supabase.co/notify-new-post`
- HTTP Method: `POST`
- Headers:
  - Content-Type: application/json
  - (필요 시) Authorization: Bearer <서비스키>  ← 보안 강화용 (선택)

> 이 설정이 완료되면, 관리자/조합원이 게시글을 등록하는 순간
> 모든 구독자에게 알림이 발송됩니다.

---

## 6) 사용자(조합원) 사용 방법

1. 사이트 접속(안드로이드 크롬)
2. 홈 화면에 추가(PWA 설치)
3. 상단에 **🔔(종) 아이콘**을 눌러 **알림 켜기**

- 종(🔔) = 알림 켜짐
- 종 슬래시(🔕) = 알림 꺼짐

---

## 알림 내용 (A안)
- 제목: 우리노동조합
- 내용: 새 게시글이 등록되었습니다.
- 알림 터치 시: 해당 게시글로 이동 (게시판/글 자동 이동)
