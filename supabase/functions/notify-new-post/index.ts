/**
 * Supabase Edge Function: notify-new-post
 * Receives a webhook payload from Supabase (Database Webhook on INSERT of public.posts)
 * Then sends Web Push notifications to ALL subscriptions.
 *
 * Required secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (e.g. "mailto:admin@yourdomain.com")
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);


function getKstMinutes(): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hh * 60 + mm;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}
function timeStrToMinutes(t: string | null): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(t || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function isInQuietHours(nowMin: number, startStr: string, endStr: string): boolean {
  const s = timeStrToMinutes(startStr);
  const e = timeStrToMinutes(endStr);
  if (s === null || e === null) return false;
  if (s === e) return true;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}
function getBoardKey(record: any): string {
  return (record?.board_key ?? record?.board ?? record?.category ?? record?.type ?? record?.menu ?? "free");
}
function buildBody(board: string): string {
  const isDispatch = String(board).startsWith("dispatch");
  return board === "notice_all"
    ? "공고/공지에 새 글이 등록되었습니다."
    : board === "family_events"
    ? "경조사 게시판에 새 글이 등록되었습니다."
    : board === "resources"
    ? "자료실에 새 자료가 업로드되었습니다."
    : isDispatch
    ? "배차표에 새 글이 등록되었습니다."
    : "자유게시판에 새 글이 등록되었습니다.";
}


function buildUrlFromPost(post: any) {
  const type = post?.type || "home";
  const id = post?.id || "";
  return `/#tab=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Supabase Database Webhook payload usually contains: record/new/old/table/schema
  const post = payload.record || payload.new || payload;
  const url = buildUrlFromPost(post);

  const board = getBoardKey(post);
  const title = "우리노동조합";
  const body = buildBody(board);

  // Global quiet hours check (admin setting)
  try {
    const { data: qs } = await supabase
      .from("push_quiet_hours")
      .select("quiet_enabled, quiet_start, quiet_end")
      .eq("id", 1)
      .maybeSingle();

    if (qs?.quiet_enabled) {
      const now = getKstMinutes();
      const start = (qs.quiet_start || "22:00") as string;
      const end = (qs.quiet_end || "09:00") as string;
      if (isInQuietHours(now, start, end)) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "quiet_hours", board }), {
          headers: { "content-type": "application/json" },
        });
      }
    }
  } catch {
    // if table missing or read fails, continue sending
  }

  // Load subscriptions
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (error) return new Response(JSON.stringify({ ok: false, error }), { status: 500 });

  const results: any[] = [];
  for (const s of subs || []) {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };

    try {
      await webpush.sendNotification(
        subscription as any,
        JSON.stringify({ title, body, url, tag: `ourunion-${board}-new-post` })
      );
      results.push({ endpoint: s.endpoint, ok: true });
    } catch (e) {
      // If subscription is gone, delete it (410 / 404 commonly)
      results.push({ endpoint: s.endpoint, ok: false, error: String(e?.message || e) });
      try {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } catch {}
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
    headers: { "content-type": "application/json" },
  });
});
