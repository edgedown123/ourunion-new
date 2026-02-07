import { ensurePushSubscribed } from './pushServiceCore';

export async function enableNotifications() {
  try {
    await ensurePushSubscribed();
    return true;
  } catch (e) {
    console.error('알림 활성화 실패:', e);
    return false;
  }
}
