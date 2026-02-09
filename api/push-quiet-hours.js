import { createClient } from '@supabase/supabase-js';

function normalizeTimeStr(t, fallback) {
  const s = String(t || '').trim();
  if (!s) return fallback;
  // Accept HH:MM (00-23:00-59)
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return fallback;
  return `${m[1]}:${m[2]}`;
}

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase configuration' });
    }

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const ADMIN_PIN = (process.env.ADMIN_PIN || '1229').trim();

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // --- Auth (admin only) ---
    const authHeader = req.headers.authorization || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : null;
    const body = req.body || {};
    const adminPin = body.adminPin || req.query?.adminPin || null;

    let is_admin = false;
    let email = null;

    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error) {
        email = data?.user?.email || null;
        if (email && ADMIN_EMAILS.includes(email)) is_admin = true;
      }
    }

    if (!token && adminPin && String(adminPin) === ADMIN_PIN) {
      is_admin = true;
      email = ADMIN_EMAILS[0] || null;
    }

    if (!is_admin) {
      return res.status(403).json({ ok: false, error: 'Admin only' });
    }

    // Ensure row exists
    const ensureRow = async () => {
      const { data } = await supabaseAdmin
        .from('push_settings')
        .select('id, quiet_enabled, quiet_start, quiet_end, updated_at')
        .eq('id', 1)
        .maybeSingle();
      if (data) return data;

      await supabaseAdmin
        .from('push_settings')
        .insert({ id: 1, quiet_enabled: false, quiet_start: '22:00', quiet_end: '09:00' });

      const { data: data2 } = await supabaseAdmin
        .from('push_settings')
        .select('id, quiet_enabled, quiet_start, quiet_end, updated_at')
        .eq('id', 1)
        .maybeSingle();
      return data2 || null;
    };

    if (req.method === 'GET') {
      const row = await ensureRow();
      return res.status(200).json({ ok: true, settings: row, email });
    }

    if (req.method === 'POST') {
      const enabled = typeof body.quiet_enabled === 'boolean' ? body.quiet_enabled : !!body.quiet_enabled;
      const quiet_start = normalizeTimeStr(body.quiet_start, '22:00');
      const quiet_end = normalizeTimeStr(body.quiet_end, '09:00');

      const { error } = await supabaseAdmin
        .from('push_settings')
        .upsert(
          {
            id: 1,
            quiet_enabled: enabled,
            quiet_start,
            quiet_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) return res.status(500).json({ ok: false, error: error.message });

      const row = await ensureRow();
      return res.status(200).json({ ok: true, settings: row });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
