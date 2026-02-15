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
    // NOTE:
    // This project already uses a per-user `push_settings` table (keyed by user_id).
    // For global admin-controlled quiet hours we use a separate table to avoid schema clashes.
    const TABLE = 'push_quiet_hours';

    const ensureRow = async () => {
      const { data } = await supabaseAdmin
        .from(TABLE)
        .select('id, quiet_enabled, quiet_start, quiet_end, updated_at')
        .eq('id', 1)
        .maybeSingle();
      if (data) return data;

      await supabaseAdmin
        .from(TABLE)
        .insert({ id: 1, quiet_enabled: false, quiet_start: '22:00', quiet_end: '09:00' });

      const { data: data2 } = await supabaseAdmin
        .from(TABLE)
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

      // Prefer UPDATE over UPSERT to avoid requiring INSERT RLS policy.
// (UPSERT uses INSERT ... ON CONFLICT, which still triggers INSERT RLS checks.)
const { data: updatedRows, error: updateError } = await supabaseAdmin
  .from(TABLE)
  .update({
    quiet_enabled: enabled,
    quiet_start,
    quiet_end,
    updated_at: new Date().toISOString(),
  })
  .eq('id', 1)
  .select('id')
  .maybeSingle();

if (updateError) return res.status(500).json({ ok: false, error: updateError.message });

// If the row somehow doesn't exist, try to create it (may require INSERT policy; service role bypasses).
if (!updatedRows) {
  const { error: insertError } = await supabaseAdmin.from(TABLE).insert({
    id: 1,
    quiet_enabled: enabled,
    quiet_start,
    quiet_end,
    updated_at: new Date().toISOString(),
  });
  if (insertError) return res.status(500).json({ ok: false, error: insertError.message });
}

      const row = await ensureRow();
      return res.status(200).json({ ok: true, settings: row });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
