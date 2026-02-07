import { ensurePushSubscribed } from './services/pushService';

// Service Worker 등록 (PWA)
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    // ready 보장
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('서비스워커 등록 실패:', e);
  }
}

// 알림 권한 + 푸시 구독 (사용자 액션 버튼에서 호출 권장)
// ✅ 로그인 사용자(토큰) 기반으로 구독 정보를 저장하기 위해 requireAuth 를 기본 적용합니다.
export async function enableNotifications() {
  try {
    const reg = await registerServiceWorker();
    if (!reg) throw new Error('서비스워커가 준비되지 않았습니다.');

    // ✅ 토큰이 준비되지 않으면 실패 처리(익명 저장 방지)
    await ensurePushSubscribed({ requireAuth: true });

    return true;
  } catch (e) {
    console.error('알림 활성화 실패:', e);
    return false;
  }
}

let _autoEnsured = false;

// 앱 시작 시 자동 재등록(권한이 이미 granted인 경우에만)
export async function autoEnsurePushSubscription() {
  if (_autoEnsured) return;
  _autoEnsured = true;

  try {
    // 권한이 이미 granted가 아니면, 사용자 팝업을 띄우지 않습니다.
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const reg = await registerServiceWorker();
    if (!reg) return;

    // silent 모드: 권한 팝업 없이 재등록/DB upsert만 수행
    // 자동 모드는 익명 저장도 허용(로그인 유무/세션 준비 지연 대응)
    await ensurePushSubscribed({ silent: true });
  } catch (e) {
    // 자동 재등록은 조용히 실패해도 괜찮음
    console.debug('autoEnsurePushSubscription skipped/failed:', e);
  }
}
