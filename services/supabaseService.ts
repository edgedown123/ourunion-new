
import { createClient } from '@supabase/supabase-js';
import type { Post, Member, SiteSettings } from '../types';

// --------------------------------------
// Supabase 연결 (Vite 환경변수)
// --------------------------------------
const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

const supabaseUrl = env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseEnabled = () =>
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl !== 'undefined' &&
  supabaseAnonKey !== 'undefined';

export const supabase = isSupabaseEnabled()
  ? createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => fetch(url as any, { ...(options as any), cache: 'no-store' as any }),
  },
})
  : null;

// --------------------------------------
// Auth helpers (A안: Supabase Auth + members.isApproved로 접근 제어)
// --------------------------------------
export const getAuthSession = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('세션 조회 실패:', error);
    return null;
  }
  return data.session;
};

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not enabled');
  return await supabase.auth.signUp({ email, password });
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not enabled');
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error('로그아웃 실패:', error);
};

// --------------------------------------
// Password recovery helpers
// --------------------------------------
export const requestPasswordResetEmail = async (email: string, redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not enabled');
  return await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
};

export const updateMyPassword = async (newPassword: string) => {
  if (!supabase) throw new Error('Supabase is not enabled');
  return await supabase.auth.updateUser({ password: newPassword });
};

export const onAuthStateChange = (
  callback: Parameters<NonNullable<typeof supabase>['auth']['onAuthStateChange']>[0]
) => {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } } as any;
  return supabase.auth.onAuthStateChange(callback);
};

export const fetchMemberByIdFromCloud = async (id: string): Promise<Member | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    const { created_at, ...rest } = data as any;
    return {
      ...rest,
      signupDate: created_at || (data as any).signupDate,
    } as Member;
  } catch (err) {
    console.error('클라우드 회원 단건 조회 실패:', err);
    return null;
  }
};

// --------------------------------------
// 게시글 동기화 (✅ 용량 폭증 방지: 목록은 경량 조회)
// --------------------------------------

/**
 * ✅ 목록 조회 전용(경량)
 * - select('*') 금지
 * - content / attachments / comments 등 무거운 필드는 목록에서 내려받지 않습니다.
 */
export const fetchPostsFromCloud = async (): Promise<Post[] | null> => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id,type,title,author,user_id,created_at,views,pinned,pinned_at')
      .order('pinned', { ascending: false })
      .order('pinned_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((p: any) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      author: p.author,
      authorId: p.user_id ?? undefined,
      createdAt: p.created_at,
      views: p.views ?? 0,
      pinned: p.pinned ?? false,
      pinnedAt: p.pinned_at ?? null,
      // ✅ 경량화: 목록에서는 본문/첨부/댓글 미포함
      content: undefined,
      attachments: undefined,
      comments: undefined,
    })) as Post[];
  } catch (err) {
    console.error('클라우드 게시글 로드 실패:', err);
    return null;
  }
};

/**
 * ✅ 상세 조회 전용(1건)
 * - 상세 진입 시에만 content/attachments/comments를 가져옵니다.
 */
export const fetchPostByIdFromCloud = async (id: string): Promise<Post | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id,type,title,content,author,user_id,created_at,views,attachments,comments,password,pinned,pinned_at')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      authorId: (data as any).user_id ?? (data as any).authorId,
      createdAt: (data as any).created_at ?? (data as any).createdAt,
      pinned: (data as any).pinned ?? false,
      pinnedAt: (data as any).pinned_at ?? (data as any).pinnedAt ?? null,
    } as Post;
  } catch (err) {
    console.error('클라우드 게시글 상세 로드 실패:', err);
    return null;
  }
};

/**
 * ✅ 조회수 증가(가볍게 UPDATE만)
 * - 기존 savePostToCloud(upsert)로 전체 row를 덮어쓰지 않도록 분리
 */
export const incrementPostViewsInCloud = async (id: string, nextViews: number) => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('posts').update({ views: nextViews }).eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('클라우드 조회수 업데이트 실패:', err);
  }
};

export const savePostToCloud = async (post: Post): Promise<boolean> => {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('posts').upsert({
      id: post.id,
      type: post.type,
      title: post.title,
      content: post.content ?? '',
      author: post.author,
      // ✅ 새 스키마: posts.user_id 사용
      user_id: post.authorId ?? null,
      created_at: post.createdAt,
      views: post.views,
      // ✅ attachments는 Storage URL만 저장해야 함
      attachments: post.attachments ?? [],
      password: post.password,
      comments: post.comments ?? [],
      pinned: post.pinned ?? false,
      pinned_at: post.pinnedAt ?? null,
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('클라우드 게시글 저장 실패:', err);
    return false;
  }
};

export const setPostPinnedInCloud = async (id: string, pinned: boolean) => {
  if (!supabase) return;
  try {
    const payload: any = { pinned };
    payload.pinned_at = pinned ? new Date().toISOString() : null;
    const { error } = await supabase.from('posts').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('클라우드 게시글 상단고정 설정 실패:', err);
  }
};

export const deletePostFromCloud = async (id: string) => {
  if (!supabase) return;

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) console.error('클라우드 게시글 삭제 실패:', error);
};

// --------------------------------------
// 회원 관리 동기화
// --------------------------------------
export const fetchMembersFromCloud = async (): Promise<Member[] | null> => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // DB의 created_at 컬럼을 앱 내부에서 사용하는 signupDate로 변환하여 리턴
    return (data ?? []).map((m: any) => {
      const { created_at, ...rest } = m;
      return {
        ...rest,
        signupDate: created_at || m.signupDate
      };
    }) as Member[];
  } catch (err) {
    console.error('클라우드 회원 로드 실패:', err);
    return null;
  }
};

export const saveMemberToCloud = async (member: Member) => {
  if (!supabase) return;

  try {
    // 1. signupDate를 제외한 나머지 데이터 추출
    // 2. DB 스키마(created_at)에 맞춰 데이터 구성하여 upsert
    const { signupDate, ...dbMember } = member;
    
    const { error } = await supabase.from('members').upsert({
      ...dbMember,
      created_at: member.signupDate // signupDate를 created_at 컬럼에 저장
    });
    
    if (error) throw error;
    console.log(`회원 정보 클라우드 저장 완료: ${member.name}`);
  } catch (err) {
    console.error('클라우드 회원 저장 실패:', err);
    throw err; // 상위에서 에러를 인지할 수 있게 던짐
  }
};

export const deleteMemberFromCloud = async (id: string) => {
  if (!supabase) return;

  try {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('클라우드 회원 삭제 실패:', err);
  }
};

// --------------------------------------
// 사이트 설정 동기화
// --------------------------------------
export const fetchSettingsFromCloud = async (): Promise<SiteSettings | null> => {
  if (!supabase) return null;

  // 1) Prefer site_settings(id='main') if exists (matches your current DB)
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('data, main_slogan, sub_slogan')
      .eq('id', 'main')
      .single();

    if (!error && data) {
      const base = (data.data ?? {}) as any;
      // If dedicated slogan columns exist, map them into settings (backward compatible)
      const merged = {
        ...base,
        ...(data.main_slogan ? { heroTitle: data.main_slogan } : {}),
        ...(data.sub_slogan ? { heroSubtitle: data.sub_slogan } : {}),
      };
      return merged as SiteSettings;
    }
  } catch {
    // ignore and fallback
  }

  // 2) Fallback to legacy settings table
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'main')
      .single();

    if (error) throw error;
    return (data?.data ?? null) as SiteSettings | null;
  } catch (err) {
    console.error('클라우드 설정 로드 실패:', err);
    return null;
  }
};


export const saveSettingsToCloud = async (settings: SiteSettings) => {
  if (!supabase) return;

  // Always keep an object in data (site_settings.data is NOT NULL in your DB)
  const safeSettings: any = settings ?? {};

  // 1) Try saving to site_settings first
  try {
    // Read existing data so we don't accidentally erase fields written by other clients
    const { data: existing } = await supabase
      .from('site_settings')
      .select('data')
      .eq('id', 'main')
      .single();

    const existingData = (existing?.data ?? {}) as any;
    const merged = { ...existingData, ...safeSettings };

    const payload: any = { id: 'main', data: merged, updated_at: new Date().toISOString() };

    // Keep dedicated slogan columns in sync if present in your schema
    if (typeof (safeSettings as any).heroTitle === 'string') payload.main_slogan = (safeSettings as any).heroTitle;
    if (typeof (safeSettings as any).heroSubtitle === 'string') payload.sub_slogan = (safeSettings as any).heroSubtitle;

    const { error } = await supabase
      .from('site_settings')
      .upsert(payload);

    if (!error) return;
    // if error, fall through to legacy table
  } catch {
    // fall through
  }

  // 2) Legacy table fallback
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'main', data: safeSettings });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('클라우드 설정 저장 실패:', err);
  }
};



// --------------------------------------
// 이미지 업로드 (Supabase Storage: site-assets)
// settings에는 base64 대신 URL을 저장하세요.
// --------------------------------------

type ResizeOptions = {
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number; // 0~1
};

const DEFAULT_RESIZE_OPTIONS: ResizeOptions = {
  maxWidth: 1280,
  maxHeight: 1280,
  jpegQuality: 0.82,
};

/**
 * 업로드 전에 이미지 파일을 클라이언트에서 리사이즈/압축합니다.
 * - 사진(대부분 JPEG)은 JPEG로 저장(quality 적용)
 * - PNG는 PNG 유지(투명도 보존)
 * - 파일이 이미지가 아니거나, 이미 충분히 작으면 원본 반환
 */
const resizeImageBeforeUpload = async (
  file: File,
  options: Partial<ResizeOptions> = {}
): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;

  const { maxWidth, maxHeight, jpegQuality } = { ...DEFAULT_RESIZE_OPTIONS, ...options };

  // 이미지 로드
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return file;

  // 이미 충분히 작으면 원본 사용
  if (srcW <= maxWidth && srcH <= maxHeight) return file;

  const ratio = Math.min(maxWidth / srcW, maxHeight / srcH);
  const dstW = Math.max(1, Math.round(srcW * ratio));
  const dstH = Math.max(1, Math.round(srcH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  // 고품질 스케일링
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, dstW, dstH);

  const keepPng = file.type === 'image/png';
  const outType = keepPng ? 'image/png' : 'image/jpeg';

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      outType,
      keepPng ? undefined : jpegQuality
    );
  });

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const ext = outType === 'image/png' ? 'png' : 'jpg';
  const newName = `${baseName}.${ext}`;

  return new File([blob], newName, {
    type: outType,
    lastModified: Date.now(),
  });
};

export const uploadSiteImage = async (file: File, pathPrefix: string): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not enabled');

  // ✅ 추천 1순위: 업로드 전에 클라이언트에서 리사이즈/압축
  const processedFile = await resizeImageBeforeUpload(file);

  const ext = processedFile.name.split('.').pop() || 'png';
  const safeName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const path = `${pathPrefix}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('site-assets')
    .upload(path, processedFile, { upsert: true, contentType: processedFile.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
  return data.publicUrl;
};


/* -----------------------------------------------------
 * ✅ 게시글 첨부 업로드 (Supabase Storage: attachments)
 * - DB에는 URL만 저장 (Base64 금지)
 * ----------------------------------------------------- */
const ATTACHMENTS_BUCKET = 'attachments';

const safeRandom = () => {
  try {
    // @ts-ignore
    return (crypto?.randomUUID?.() as string) || Math.random().toString(16).slice(2);
  } catch {
    return Math.random().toString(16).slice(2);
  }
};

export const uploadPostAttachment = async (file: File, postId: string): Promise<any> => {
  if (!supabase) throw new Error('Supabase is not enabled');

  // 이미지면 리사이즈/압축 (용량 절감)
  const processed = await resizeImageBeforeUpload(file).catch(() => file);

  const ext = processed.name.split('.').pop() || 'bin';
  const safeName = `${Date.now()}_${safeRandom()}.${ext}`;
  const path = `posts/${postId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, processed, { upsert: true, contentType: processed.type });

  if (uploadError) throw uploadError;

  // public bucket이면 publicUrl 사용
  const pub = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  let url = pub?.data?.publicUrl || '';

  // publicUrl이 비어있으면(비공개 버킷) signed url fallback
  if (!url) {
    const { data: signed, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1년
    if (error) throw error;
    url = signed?.signedUrl || '';
  }

  return {
    name: file.name,
    type: processed.type || file.type,
    url,
    path,
    size: processed.size || file.size,
  };
};

export const deletePostAttachments = async (paths: string[]) => {
  if (!supabase) return;
  const safe = (paths || []).filter(Boolean);
  if (safe.length === 0) return;
  try {
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(safe);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('첨부파일 Storage 삭제 실패(무시 가능):', err);
  }
};

/**
 * ✅ 작성/수정 저장 직전에 첨부 목록을 "URL 기반"으로 정규화합니다.
 * - DraftAttachment(file 포함)은 업로드 후 URL로 변환
 * - 기존 URL 첨부는 유지
 * - 제거된 첨부(편집 시) path가 있으면 Storage에서도 삭제(가능한 범위에서)
 */
export const preparePostAttachmentsForSave = async (
  draft: any[] | undefined,
  postId: string,
  prev: any[] | undefined
) => {
  const nextDraft = Array.isArray(draft) ? draft : [];
  const prevList = Array.isArray(prev) ? prev : [];

  // 삭제된 것들(이전에는 있었는데 draft에는 없는 것)
  const nextPaths = new Set(nextDraft.map((a: any) => a?.path).filter(Boolean));
  const removedPaths = prevList.map((a: any) => a?.path).filter((p: any) => p && !nextPaths.has(p));

  // 업로드 필요한 새 파일들
  const newOnes = nextDraft.filter((a: any) => a?.file instanceof File);
  const existing = nextDraft
    .filter((a: any) => !(a?.file instanceof File))
    .map((a: any) => ({
      name: a.name,
      type: a.type,
      url: a.url || a.data || '',
      path: a.path,
      size: a.size,
    }));

  const uploaded = [];
  for (const a of newOnes) {
    const u = await uploadPostAttachment(a.file as File, postId);
    uploaded.push(u);
  }

  // best-effort 삭제
  if (removedPaths.length > 0) {
    await deletePostAttachments(removedPaths as string[]);
  }

  return [...existing, ...uploaded];
};
