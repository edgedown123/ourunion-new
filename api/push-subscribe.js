import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        ok: false,
        error: 'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY',
        debug: { hasSupabaseUrl: !!supabaseUrl, hasServiceRoleKey: !!serviceRoleKey },
      });
    }

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const { endpoint, p256dh, auth, userAgent, isPwa, displayMode, platform } = req.body || {};
    if (!endpoint) return res.status(400).json({ ok: false, error: 'Missing endpoint' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.authorization || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : null;

    let email = null;
    let user_id = null;
    let is_admin = false;

    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error) {
        user_id = data?.user?.id || null;
        email = data?.user?.email || null;
        if (email) is_admin = ADMIN_EMAILS.includes(email);
      }
    }

    const { error: upsertError } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh: p256dh ?? null,
          auth: auth ?? null,
          user_agent: userAgent ?? null,
          is_pwa: typeof isPwa === 'boolean' ? isPwa : null,
          display_mode: displayMode ?? null,
          platform: platform ?? null,
          email,
          is_admin,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (upsertError) {
      return res.status(500).json({ ok: false, error: upsertError.message });
    }

    return res.status(200).json({
      ok: true,
      stored: true,
      email,
      is_admin,
      debug: {
        hasAuthorizationHeader: !!authHeader,
        hasBearer,
        tokenLength: token ? token.length : 0,
        adminEmailsCount: ADMIN_EMAILS.length,
        adminEmails: ADMIN_EMAILS,
        supabaseUrlHost: (() => {
          try { return new URL(supabaseUrl).host; } catch { return null; }
        })(),
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
