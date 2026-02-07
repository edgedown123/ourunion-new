import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 관리자 이메일 목록 (Vercel 환경변수)
// 예: edgedown@naver.com,admin2@naver.com
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      subscription,
      is_pwa,
      display_mode,
      platform,
    } = req.body || {};

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription' });
    }

    // Authorization 헤더에서 JWT 추출
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : null;

    let email = null;
    let is_admin = false;

    // JWT가 있으면 유저 정보 조회
    if (token) {
      const { data: userData, error: userError } =
        await supabase.auth.getUser(token);

      if (!userError && userData?.user?.email) {
        email = userData.user.email;
        is_admin = ADMIN_EMAILS.includes(email);
      }
    }

    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh || null,
          auth: subscription.keys?.auth || null,
          is_pwa: !!is_pwa,
          display_mode: display_mode || null,
          platform: platform || null,
          email,
          is_admin,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (upsertError) {
      console.error('push_subscriptions upsert error:', upsertError);
      return res.status(500).json({ error: 'DB error' });
    }

    return res.status(200).json({
      success: true,
      email,
      is_admin,
    });
  } catch (err) {
    console.error('push-subscribe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
