
# 🚩 우리노동조합 공식 홈페이지

이 프로젝트는 우리노동조합의 공식 웹사이트입니다. Vercel을 통해 배포 및 운영됩니다.

## 🚀 배포 방법 (Vercel)

1. 이 저장소를 **GitHub**에 업로드합니다.
2. [Vercel](https://vercel.com/)에서 이 저장소를 가져옵니다(Import).
3. **Environment Variables**에 아래 2개를 추가합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy** 버튼을 누르면 끝!

## 🌐 도메인 연결 정보 (아이티이지)
Vercel 설정의 'Domains' 메뉴에서 `ourunion.co.kr`을 추가하고 아래 값을 입력하세요.
- **A Record**: `216.198.79.1` (Vercel 최신 추천 값)
- **CNAME**: `cname.vercel-dns.com`

*참고: 기존 76.76.21.21 주소도 작동하지만, Vercel의 권장사항에 따라 위 주소 사용을 권장합니다.*

## 🛠 관리자 정보
- **관리자 페이지**: 사이트 우측 상단 톱니바퀴 아이콘
- **초기 비밀번호**: `1229`
