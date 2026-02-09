/**
 * Vercel Serverless Function (Node.js) to send Web Push to ADMINS when a member signs up (application submitted).
 * Intended to be called by Supabase Database Webhook on members INSERT.
 *
 * Required env vars (same as other push endpoints):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT
 *
 * Admin routing:
 * - push_subscriptions table should have boolean column: is_admin
 * - api/push-subscribe.js will set is_admin=true when authenticated user's email is in ADMIN_EMAILS
 * - ADMIN_EMAILS: comma-separated emails (lower/upper ok)
 *
 * Optional security:
 * - WEBHOOK_SECRET: if set, this endpoint requires header "x-webhook-secret" to match.
 */
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

function getKstMinutes() {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hh * 60 + mm;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function timeStrToMinutes(t) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(t || '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isInQuietHours(nowMin, startStr, endStr) {
  const s = timeStrToMinutes(startStr);
  const e = timeStrToMinutes(endStr);
  if (s === null || e === null) return false;
  if (s === e) return true;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}

function getJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (!req.body) return null;
  try { return JSON.parse(req.body); } catch { return null; }
}

function pickRecord(payload) {
  return payload?.record ?? payload?.new ?? payload?.data?.record ?? null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const got = String(req.headers["x-webhook-secret"] || "");
      if (got !== String(webhookSecret)) {
        return res.status(401).json({ ok: false, error: "Unauthorized (bad webhook secret)" });
      }
    }

    const payload = getJsonBody(req);
    const record = pickRecord(payload);
    if (!record) return res.status(400).json({ ok: false, error: "Missing record" });

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_SUBJECT,
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      return res.status(500).json({ ok: false, error: "Missing VAPID env vars" });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Quiet hours (global)
    try {
      const { data: qs } = await supabase
        .from('push_settings')
        .select('quiet_enabled, quiet_start, quiet_end')
        .eq('id', 1)
        .maybeSingle();
      if (qs?.quiet_enabled) {
        const now = getKstMinutes();
        const start = qs.quiet_start || '22:00';
        const end = qs.quiet_end || '09:00';
        if (isInQuietHours(now, start, end)) {
          return res.status(200).json({ ok: true, skipped: true, reason: 'quiet_hours', quiet: { enabled: true, start, end } });
        }
      }
    } catch {}

    // Fetch admin subscriptions
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("is_admin", true)
      .limit(2000);

    if (error) {
      return res.status(500).json({ ok: false, error: `Failed to read admin subscriptions: ${error.message}` });
    }

    const memberNameRaw = record?.name || record?.email || "신규 신청자";
    const memberName = String(memberNameRaw).includes("@")
      ? String(memberNameRaw).split("@")[0]
      : String(memberNameRaw);
    const garage = record?.garage ? ` (${record.garage})` : "";
    const title = "우리노동조합 · 가입 신청";
    const body = `${memberName}${garage} 회원이 가입 신청서를 제출했습니다.`;
    const url = "/#tab=admin&view=signup"; // 앱에서 admin 탭으로 이동(해시 기반)
    const tag = "admin-signup";

    const notificationPayload = JSON.stringify({ title, body, url, tag });

    let sent = 0;
    let failed = 0;

    const concurrency = 10;
    const queue = [...(subs || [])];

    async function worker() {
      while (queue.length) {
        const row = queue.shift();
        if (!row?.endpoint || !row?.p256dh || !row?.auth) { failed++; continue; }

        const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };

        try {
          await webpush.sendNotification(subscription, notificationPayload, {
            TTL: 60 * 60,
            headers: { "Cache-Control": "no-store" },
          });
          sent++;
        } catch (e) {
          failed++;
          const status = e?.statusCode || e?.status || null;
          if (status === 404 || status === 410) {
            try { await supabase.from("push_subscriptions").delete().eq("id", row.id); } catch {}
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return res.status(200).json({ ok: true, sent, failed, total: (subs || []).length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}