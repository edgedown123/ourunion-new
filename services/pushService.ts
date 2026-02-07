async function getAccessTokenWithRetry(maxMs = 5000, intervalMs = 250): Promise<string | null> {
  if (!supabase) return null;

  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || null;
    if (token) return token;

    // Fallback: session not ready yet, try localStorage (Supabase v2)
    const lsToken = typeof window !== 'undefined' ? getAccessTokenFromLocalStorage() : null;
    if (lsToken) return lsToken;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

import { supabase } from './supabaseService';

const VAPID_PUBLIC_KEY_RAW = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY : undefined) || '';
const VAPID_PUBLIC_KEY = (VAPID_PUBLIC_KEY_RAW || '').trim();

function getSupabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).host; // e.g. xxx.supabase.co
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function getAccessTokenFromLocalStorage(): string | null {
  try {
    // Supabase JS v2 stores session under key: sb-<project-ref>-auth-token
    const supaUrl = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined) || '';
    const ref = getSupabaseProjectRefFromUrl(String(supaUrl));
    if (!ref) return null;

    const key = `sb-${ref}-auth-token`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // structure may be { access_token, ... } or { currentSession: {...} }
    const token =
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.data?.session?.access_token ||
      null;

    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

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

function getDisplayMode(): string {
  if (typeof window === 'undefined') return 'unknown';
  const nav: any = navigator as any;

  // iOS Safari legacy
  if (nav?.standalone) return 'standalone';

  if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
  if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return 'minimal-ui';
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return 'fullscreen';
  return 'browser';
}

export function getPushEnvironment() {
  if (typeof window === 'undefined') {
    return {
      userAgent: '',
      platform: '',
      displayMode: 'unknown',
      isPwa: false,
    };
  }
  const userAgent = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || (navigator.platform || '');
  const displayMode = getDisplayMode();
  const isPwa = displayMode !== 'browser' && displayMode !== 'unknown';
  return { userAgent, platform, displayMode, isPwa };
}

export async function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied' as NotificationPermission;
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied' as NotificationPermission;
  return await Notification.requestPermission();
}

export async function ensurePushSubscribed(opts?: { silent?: boolean; requireAuth?: boolean }) {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID 공개키(VITE_VAPID_PUBLIC_KEY)가 설정되지 않았습니다.');

  const perm = await getNotificationPermission();
  if (perm !== 'granted') {
    if (opts?.silent) {
      // 자동 재등록 모드에서는 사용자 팝업을 띄우지 않습니다.
      throw new Error('알림 권한이 granted가 아닙니다. (silent)');
    }
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

  // 조합원(로그인) 전용 흐름에서 강제하고 싶을 때
  if (opts?.requireAuth && !accessToken) {
    throw new Error('로그인 상태를 확인할 수 없어 알림 설정을 진행할 수 없습니다. 새로고침 후 다시 시도해주세요.');
  }

  // accessToken이 없더라도(세션 준비 지연/비로그인) 익명으로 저장을 시도합니다.
  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = (json.keys as any)?.p256dh ?? null;
  const auth = (json.keys as any)?.auth ?? null;

  const env = getPushEnvironment();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint,
      p256dh,
      auth,
      userAgent: env.userAgent,
      platform: env.platform,
      isPwa: env.isPwa,
      displayMode: env.displayMode,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`push-subscribe API 실패 (${res.status}): ${text}`);
  }

  const resp = await res.json().catch(() => ({} as any));
  return { sub, ...resp };
}

export async function getClientPushStatus() {
  const supported = isPushSupported();
  const permission = await getNotificationPermission().catch(() => 'denied' as NotificationPermission);
  const env = getPushEnvironment();

  let swReady = false;
  let swScope: string | null = null;
  let subscription: any = null;

  if (supported) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('ready timeout')), 3000)),
      ]) as ServiceWorkerRegistration;
      swReady = true;
      swScope = reg.scope || null;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        subscription = {
          endpoint: sub.endpoint,
          p256dh: (json.keys as any)?.p256dh ?? null,
          auth: (json.keys as any)?.auth ?? null,
        };
      }
    } catch {
      // ignore
    }
  }

  return {
    supported,
    permission,
    env,
    swReady,
    swScope,
    subscription,
  };
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
