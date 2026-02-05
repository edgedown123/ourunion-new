async function getAccessTokenWithRetry(maxMs = 5000, intervalMs = 250): Promise<string | null> {
  if (!supabase) return null;

  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || null;
    if (token) return token;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

import { supabase } from './supabaseService';

const VAPID_PUBLIC_KEY_RAW = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY : undefined) || '';
const VAPID_PUBLIC_KEY = (VAPID_PUBLIC_KEY_RAW || '').trim();

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied' as NotificationPermission;
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied' as NotificationPermission;
  return await Notification.requestPermission();
}

export async function ensurePushSubscribed() {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID 공개키(VITE_VAPID_PUBLIC_KEY)가 설정되지 않았습니다.');

  const perm = await getNotificationPermission();
  if (perm !== 'granted') {
    const p = await requestNotificationPermission();
    if (p !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');
  }

  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('서비스워커 준비가 지연됩니다. (ready 타임아웃)')), 8000)),
  ]) as ServiceWorkerRegistration;

  const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY.trim());
  if (appServerKey.byteLength !== 65) {
    throw new Error(`VAPID 공개키가 비정상입니다 (${appServerKey.byteLength} bytes)`);
  }

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    }));

  const accessToken = await getAccessTokenWithRetry(5000, 250);
// accessToken이 없더라도(세션 준비 지연/비로그인) 익명으로 저장을 시도합니다.
  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = (json.keys as any)?.p256dh ?? null;
  const auth = (json.keys as any)?.auth ?? null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint, p256dh, auth, userAgent: navigator.userAgent }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`push-subscribe API 실패 (${res.status}): ${text}`);
  }

  const resp = await res.json().catch(() => ({} as any));
  return { sub, ...resp };
}

export async function unsubscribePush() {
  if (!isPushSupported()) return false;
  if (!supabase) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();

  // DB에서도 삭제 시도 (실패해도 ok)
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token || null;
    if (accessToken) {
      await fetch('/api/push-unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint }),
      });
    } else {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch {}
  return ok;
}
