/**
 * Vercel Serverless Function (Node.js) to send Web Push on new posts.
 * Called by Supabase Database Webhook (posts INSERT/UPDATE).
 *
 * Set these env vars in Vercel Project Settings:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (e.g. "mailto:you@example.com")
 *
 * Optional:
 * - PUSH_SUBSCRIPTIONS_TABLE (default: "push_subscriptions")
 */
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
function getJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (!req.body) return null;
  try { return JSON.parse(req.body); } catch { return null; }
}

function pickRecord(payload) {
  return payload?.record ?? payload?.new ?? payload?.data?.record ?? null;
}

function getBoardKey(record) {
  return (
    record?.board_key ??
    record?.board ??
    record?.category ??
    record?.type ??
    record?.menu ??
    null
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const payload = getJsonBody(req);
    if (!payload) return res.status(400).json({ ok: false, error: "Invalid JSON body" });

    const record = pickRecord(payload);
    if (!record) return res.status(400).json({ ok: false, error: "Missing record in webhook payload" });

    const board = getBoardKey(record) || "free";
    const postId = record.id ?? record.post_id ?? record.uuid ?? null;

    const title = payload.title || "우리노동조합";
    const body =
      payload.body ||
      (board === "notice_all" ? "공고/공지에 새 글이 등록되었습니다."
        : board === "family_events" ? "경조사 게시판에 새 글이 등록되었습니다."
        : board === "resources" ? "자료실에 새 자료가 업로드되었습니다."
        : "자유게시판에 새 글이 등록되었습니다.");

    const url = postId ? `/#tab=${encodeURIComponent(board)}&id=${encodeURIComponent(String(postId))}`
                       : `/#tab=${encodeURIComponent(board)}`;
    const tag = String(payload.tag || board);

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_SUBJECT,
      PUSH_SUBSCRIPTIONS_TABLE,
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

    const table = PUSH_SUBSCRIPTIONS_TABLE || "push_subscriptions";
    const { data: subs, error } = await supabase.from(table).select("id, endpoint, p256dh, auth").limit(2000);

    if (error) {
      return res.status(500).json({ ok: false, error: `Failed to read ${table}: ${error.message}` });
    }

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
            try { await supabase.from(table).delete().eq("id", row.id); } catch {}
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return res.status(200).json({ ok: true, board, postId, sent, failed, total: (subs || []).length, url, tag });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
