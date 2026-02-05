import { supabase } from './supabase'

/**
 * ✅ 회원가입: Supabase Auth에 계정이 영구 생성됩니다.
 * - SQL에서 트리거(handle_new_user)를 이미 만들었으므로 profiles row도 자동 생성됩니다.
 * - 이메일 확인(Email Confirm)이 켜져있다면, user가 바로 로그인 상태가 아닐 수 있습니다.
 */
export async function signUp(email: string, password: string, nickname?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: nickname ? { data: { nickname } } : undefined,
  })
  if (error) throw error
  return data
}

/** ✅ 로그인 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/** ✅ 로그아웃: 절대 profiles/members를 delete 하지 마세요. */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** 현재 세션 가져오기 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/** 프로필 조회(로그인 상태에서만 가능 / RLS 적용) */
export async function getMyProfile() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,nickname,role,created_at,updated_at')
    .eq('id', user.id)
    .single()

  // profiles row가 아직 없을 경우를 방어(트리거가 있다면 보통 발생하지 않음)
  if (error) {
    // PostgREST "No rows found"는 null 반환
    // @ts-ignore
    if (error?.code === 'PGRST116') return null
    throw error
  }
  return data
}
