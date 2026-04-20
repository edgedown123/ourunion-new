import { createClient } from '@supabase/supabase-js';

function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.body) return null;
  try {
    return JSON.parse(req.body);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = getJsonBody(req);
    const adminPin = String(body?.adminPin || '').trim();
    const expectedPin = String(process.env.ADMIN_PIN || '1229').trim();

    if (!adminPin || adminPin !== expectedPin) {
      return res.status(401).json({ ok: false, error: '관리자 인증에 실패했습니다.' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase server env vars' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const action = body?.action;
    if (action === 'save') {
      const post = body?.post;
      if (!post?.id || !post?.type || !post?.title) {
        return res.status(400).json({ ok: false, error: '게시글 정보가 올바르지 않습니다.' });
      }

      const payload = {
        id: String(post.id),
        type: post.type,
        title: post.title,
        content: post.content || '',
        author: post.author || '관리자',
        created_at: post.createdAt || new Date().toISOString(),
        views: Number(post.views || 0),
        attachments: post.attachments || [],
        password: post.password || null,
        comments: post.comments || [],
        pinned: !!post.pinned,
        pinned_at: post.pinnedAt || null,
      };

      const { data: existing, error: existingError } = await supabase
        .from('posts')
        .select('id')
        .eq('id', payload.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const query = existing
        ? supabase.from('posts').update(payload).eq('id', payload.id)
        : supabase.from('posts').insert(payload);

      const { error } = await query;
      if (error) throw error;

      return res.status(200).json({ ok: true, mode: existing ? 'update' : 'insert', id: payload.id });
    }

    if (action === 'delete') {
      const postId = String(body?.postId || '').trim();
      if (!postId) {
        return res.status(400).json({ ok: false, error: '삭제할 게시글 ID가 없습니다.' });
      }

      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;

      return res.status(200).json({ ok: true, mode: 'delete', id: postId });
    }

    return res.status(400).json({ ok: false, error: '지원하지 않는 작업입니다.' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
