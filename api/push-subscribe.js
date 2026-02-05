import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    const { endpoint, p256dh, auth, userAgent } = req.body || {};
    if (!endpoint) return res.status(400).json({ ok: false, error: 'Missing endpoint' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Optional user linkage
    let user_id = null;
    let anonymous = true;

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice('Bearer '.length);
      try {
        const { data } = await supabaseAdmin.auth.getUser(jwt);
        user_id = data?.user?.id || null;
        anonymous = !user_id;
      } catch {
        // ignore token errors; store anonymously
      }
    }

    const payloadBase = {
      endpoint,
      p256dh: p256dh ?? null,
      auth: auth ?? null,
      last_seen_at: new Date().toISOString(),
    };

    // user_id가 있을 때만 저장(익명 저장 시 기존 user_id를 덮어쓰지 않기 위함)
    const payload = user_id ? { ...payloadBase, user_id } : payloadBase;

    // userAgent 컬럼이 있는 DB/없는 DB 모두 대응
    const payloadWithUA = userAgent ? { ...payload, user_agent: String(userAgent).slice(0, 500) } : payload;

    let upsertError = null;

// 1차: user_agent 포함 시도(컬럼이 없을 수 있어 실패하면 재시도)
if (payloadWithUA && payloadWithUA.user_agent) {
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(payloadWithUA, { onConflict: 'endpoint' });
  upsertError = error;

  // user_agent 컬럼이 없다는 에러면 무시하고 아래에서 재시도
  if (upsertError && /user_agent/i.test(upsertError.message || '')) {
    upsertError = null;
  }
}

// 2차: user_agent 없이 (또는 userAgent 없음 / 컬럼 없음으로 판단되어 재시도)
if (!payloadWithUA?.user_agent || upsertError === null) {
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
  upsertError = error;
}


    if (upsertError) return res.status(500).json({ ok: false, error: upsertError.message });

    return res.status(200).json({ ok: true, stored: true, anonymous, user_id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
