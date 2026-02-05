// api/push-test.js
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { secret, msg } = req.query;

    if (!process.env.PUSH_TEST_SECRET) {
      return res.status(500).json({ ok: false, error: "Missing PUSH_TEST_SECRET" });
    }
    if (secret !== process.env.PUSH_TEST_SECRET) {
      return res.status(401).json({ ok: false, error: "Invalid secret" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

    for (const [k, v] of Object.entries({
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_SUBJECT,
    })) {
      if (!v) return res.status(500).json({ ok: false, error: `Missing env: ${k}` });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,user_id")
      .order("id", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const payload = JSON.stringify({
      title: "서버 푸시 테스트",
      body: msg || "✅ 서버에서 푸시 발송 성공!",
      url: "/",
    });

    const results = [];
    for (const row of data || []) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        await webpush.sendNotification(subscription, payload);
        results.push({ endpoint: row.endpoint, ok: true });
      } catch (e) {
        results.push({ endpoint: row.endpoint, ok: false, error: String(e?.message || e) });
      }
    }

    return res.status(200).json({
      ok: true,
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
