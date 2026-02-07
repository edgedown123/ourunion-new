import type { Member } from '../types';

// Optional client-side secret header (NOT recommended for public clients).
// If you deploy notify endpoints behind a webhook secret, set VITE_WEBHOOK_SECRET on the client as well.
const WEBHOOK_SECRET = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_WEBHOOK_SECRET : undefined) || '';

async function postNotify(path: string, record: any) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WEBHOOK_SECRET && String(WEBHOOK_SECRET).trim().length > 0) {
      headers['x-webhook-secret'] = String(WEBHOOK_SECRET).trim();
    }

    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify({ record }),
    });

    // Best-effort: we don't block UX on notification failure.
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[push][admin] notify failed (${path}):`, res.status, text);
    }
  } catch (e) {
    console.warn(`[push][admin] notify error (${path}):`, e);
  }
}

export async function notifyAdminSignup(member: Pick<Member, 'name' | 'garage' | 'email' | 'phone' | 'birthDate'>) {
  await postNotify('/api/notify-admin-signup', member);
}

export async function notifyAdminWithdraw(member: Pick<Member, 'name' | 'garage' | 'email' | 'phone' | 'birthDate'>) {
  await postNotify('/api/notify-admin-withdraw', member);
}
