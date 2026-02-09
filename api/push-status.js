import { createClient } from '@supabase/supabase-js';

// 현재 브라우저(클라이언트) 구독 endpoint가 DB에 저장돼 있는지 확인하는 디버그 API
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    const endpoint = (req.method === 'GET' ? req.query?.endpoint : req.body?.endpoint) || '';
    if (!endpoint) return res.status(400).json({ ok: false, error: 'Missing endpoint' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, user_id, user_agent, is_pwa, display_mode, platform, last_seen_at, created_at')
      .eq('endpoint', endpoint)
      .order('id', { ascending: false })
      .limit(1);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const row = (data || [])[0] || null;
    return res.status(200).json({ ok: true, exists: !!row, row, serverTime: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
