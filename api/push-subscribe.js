import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    const { endpoint, p256dh, auth, userAgent, isPwa, displayMode, platform } = req.body || {};
    if (!endpoint) return res.status(400).json({ ok: false, error: 'Missing endpoint' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    
    // Optional user linkage
    let user_id = null;
    let anonymous = true;
    let user_email = null;
    let is_admin = false;

    const adminEmails = String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice('Bearer '.length);
      try {
                const { data } = await supabaseAdmin.auth.getUser(jwt);
        user_id = data?.user?.id || null;
        user_email = data?.user?.email || null;
        anonymous = !user_id;
        if (user_email && adminEmails.length > 0) {
          is_admin = adminEmails.includes(String(user_email).toLowerCase());
        }
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

    // 추가 메타데이터(컬럼이 없을 수도 있으므로 서버에서 유연하게 처리)
    const extra = {
      ...(user_id ? { is_admin } : {}),
      ...(user_email ? { email: String(user_email).toLowerCase() } : {}),
      ...(userAgent ? { user_agent: String(userAgent).slice(0, 500) } : {}),
      ...(typeof isPwa === 'boolean' ? { is_pwa: isPwa } : {}),
      ...(displayMode ? { display_mode: String(displayMode).slice(0, 50) } : {}),
      ...(platform ? { platform: String(platform).slice(0, 80) } : {}),
    };

    let upsertError = null;

    // 1차: extra 포함
    const { error: e1 } = await supabaseAdmin.from('push_subscriptions').upsert({ ...payload, ...extra }, { onConflict: 'endpoint' });
    upsertError = e1;

    // 컬럼이 없어서 실패하면, extra를 빼고 재시도
    if (upsertError) {
      const msg = (upsertError.message || '').toLowerCase();
      const looksLikeMissingColumn = msg.includes('column') || msg.includes('does not exist') || msg.includes('unknown');
      if (looksLikeMissingColumn) {
        const { error: e2 } = await supabaseAdmin.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
        upsertError = e2;
      }
    }


    if (upsertError) return res.status(500).json({ ok: false, error: upsertError.message });

    return res.status(200).json({ ok: true, stored: true, anonymous, user_id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
