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

    // 관리자 이메일 목록 (쉼표 구분)
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    // ✅ (선택) 관리자 PIN: 서버에서 검증 (없으면 기본값 1229)
    // - 현재 프론트에 이미 1229가 하드코딩되어 있어 보안 수준이 더 떨어지지 않습니다.
    // - 원하면 Vercel env에 ADMIN_PIN을 추가해서 PIN을 바꿀 수 있습니다.
    const ADMIN_PIN = (process.env.ADMIN_PIN || '1229').trim();

    const body = req.body || {};
    const { endpoint, p256dh, auth, userAgent, isPwa, displayMode, platform, adminPin } = body;

    if (!endpoint) return res.status(400).json({ ok: false, error: 'Missing endpoint' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.authorization || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : null;

    let email = null;
    let user_id = null;
    let is_admin = false;

    // 1) Supabase Auth 토큰이 있으면 그걸로 이메일/관리자 판별
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error) {
        user_id = data?.user?.id || null;
        email = data?.user?.email || null;
        if (email && ADMIN_EMAILS.includes(email)) is_admin = true;
      }
    }

    // 2) 토큰이 없지만 "관리자 화면"에서 저장하는 케이스(로컬 관리자 인증)
    //    - 프론트에서 adminPin을 보내고, 서버에서 ADMIN_PIN과 비교해 승인
    if (!token && adminPin && String(adminPin).trim() === ADMIN_PIN) {
      is_admin = true;
      // 관리자 이메일은 서버 env의 첫 번째 값을 사용 (없으면 null)
      email = ADMIN_EMAILS[0] || null;
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
        usedAdminPin: !token && !!adminPin,
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
