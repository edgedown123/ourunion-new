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

function buildUrlFromPost(post: any) {
  const type = post?.type || "home";
  const id = post?.id || "";
  return `/#tab=${encodeURIComponent(type)}&post=${encodeURIComponent(id)}`;
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

  const title = "우리노동조합";
  const body = "새 게시글이 등록되었습니다.";

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
        JSON.stringify({ title, body, url, tag: "ourunion-new-post" })
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
