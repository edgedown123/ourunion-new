// Vercel Serverless Function
// URL: /api/push-test?secret=...&msg=...

const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const secret = req.query.secret;
    if (!process.env.PUSH_TEST_SECRET || secret !== process.env.PUSH_TEST_SECRET) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const message = req.query.msg || "테스트 푸시입니다 ✅";

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .order("id", { ascending: true });

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return res.status(200).json({ ok: false, error: "no subscriptions" });
    }

    const payload = JSON.stringify({
      title: "우리노동조합",
      body: message,
      url: "/#tab=board",
    });

    const results = [];
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload
        );
        results.push({ id: s.id, ok: true });
      } catch (e) {
        results.push({
          id: s.id,
          ok: false,
          statusCode: e?.statusCode,
          message: e?.message,
        });
      }
    }

    return res.status(200).json({ ok: true, count: subs.length, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
