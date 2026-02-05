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
export async function enableNotifications() {
  try {
    const reg = await registerServiceWorker();
    if (!reg) throw new Error('서비스워커가 준비되지 않았습니다.');
    await ensurePushSubscribed();
    return true;
  } catch (e) {
    console.error('알림 활성화 실패:', e);
    return false;
  }
}
