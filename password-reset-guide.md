# 비밀번호 재설정(찾기) 기능 설정 가이드

이 프로젝트는 Supabase Auth의 **비밀번호 재설정(Recovery)** 기능을 사용합니다.

---

## 1) Supabase Redirect URLs 설정

1. Supabase Dashboard → Authentication → URL Configuration(또는 Redirect URLs)
2. 아래 URL을 **Allow list**에 추가합니다.

- `https://YOUR_DOMAIN/?reset=1`
- 개발용: `http://localhost:5173/?reset=1`

> 이 프로젝트는 재설정 메일에서 돌아올 때 `?reset=1` 쿼리 파라미터를 사용해
> 앱이 “새 비밀번호 설정 화면”을 자동으로 열도록 구현되어 있습니다.

---

## 2) 로그인 모달에서 “비밀번호 재설정” 사용법

- 로그인 모달의 **“비밀번호를 잊으셨나요? 재설정하기”**를 누르면,
  이메일 입력 후 재설정 링크가 발송됩니다.

---

## 3) Supabase 이메일 템플릿(한국어) 커스터마이징

Supabase Dashboard → Authentication(또는 Auth) → Emails → Templates 에서
**Reset password(Recovery)** 템플릿을 아래 예시처럼 수정하세요.

### (권장) 제목(Subject)

```
[우리노동조합] 비밀번호 재설정 안내
```

### (권장) 본문(HTML)

아래 예시는 기본 변수 `{{ .ConfirmationURL }}` 를 사용합니다.

```html
<h2 style="margin:0 0 12px 0;">비밀번호 재설정 안내</h2>
<p style="margin:0 0 12px 0;">안녕하세요. 우리노동조합입니다.</p>
<p style="margin:0 0 16px 0;">아래 버튼을 눌러 비밀번호를 새로 설정해 주세요.</p>
<p style="margin:0 0 20px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;">
    비밀번호 재설정하기
  </a>
</p>
<p style="margin:0 0 8px 0; color:#666; font-size:12px;">※ 본 메일은 비밀번호 재설정을 요청한 경우에만 발송됩니다.</p>
<p style="margin:0 0 0 0; color:#666; font-size:12px;">※ 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
```

---

## 4) 자주 발생하는 문제

### 1) 링크를 눌렀는데 reset 화면이 안 뜸
- Supabase Redirect URLs allow list에 `https://YOUR_DOMAIN/?reset=1` 이 추가되어 있는지 확인
- 링크가 `.../?reset=1#access_token=...` 형태로 들어오는지 확인

### 2) “Auth session missing” 같은 오류
- 재설정 링크는 Supabase가 세션을 부여한 후 앱으로 돌아옵니다.
- 메일 링크를 그대로 클릭해서 들어오면 정상입니다(복사/변형/리디렉트 금지).

