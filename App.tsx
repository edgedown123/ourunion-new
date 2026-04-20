
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BoardType, Post, SiteSettings, UserRole, Member, PostAttachment, Comment } from './types';
import { INITIAL_POSTS, INITIAL_SETTINGS } from './constants';
import Layout from './components/Layout';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PushOnboardingCard from './components/PushOnboardingCard';
import Board from './components/Board';
import NoticeLanding from './components/NoticeLanding';
import NoticeSingle from './components/NoticeSingle';
import { DispatchLanding } from './components/DispatchSheet';
import AdminPanel from './components/AdminPanel';
import PostEditor from './components/PostEditor';
import Introduction from './components/Introduction';
import Footer from './components/Footer';
import SignupForm from './components/SignupForm';
import * as cloud from './services/supabaseService';
import { isSupabaseEnabled } from './services/supabaseService';
import { getClientPushStatus, isPushSupported } from './services/pushService';
import { notifyAdminSignup, notifyAdminWithdraw } from './services/adminNotifyService';

const App: React.FC = () => {
  useEffect(() => {
    console.log('🔥 Supabase 연동 상태:', isSupabaseEnabled());
  }, []);

  // 최초 진입 시 hash(#tab=...&post=...)를 읽어서 화면 상태 복원
  useEffect(() => {
    const s = readHash();
    if (s.tab) setActiveTab(s.tab);
    if (s.postId) setSelectedPostId(s.postId);
    if (s.writing) {
      // 글쓰기 화면은 게시글 상세보다 우선
      setIsWriting(true);
    }
    // 초기 상태도 히스토리에 고정
    replaceNav({ tab: s.tab || 'home', postId: s.postId || null, writing: !!s.writing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 뒤로가기/앞으로가기(popstate) 처리
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = (e.state || readHash()) as NavState;

      // 탭 이동
      setActiveTab(state.tab || 'home');

      // 글쓰기 / 상세 / 목록 상태 정리
      if (state.writing) {
        setIsWriting(true);
        setEditingPost(null);
        setSelectedPostId(null);
      } else if (state.postId) {
        setIsWriting(false);
        setEditingPost(null);
        setSelectedPostId(state.postId);
      } else {
        setIsWriting(false);
        setEditingPost(null);
        setSelectedPostId(null);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 서비스워커(notificationclick) 등으로 URL 해시가 바뀌는 경우에도 화면 상태를 동기화
  useEffect(() => {
    const onHashChange = () => {
      const state = readHash();

      // 탭 이동
      setActiveTab(state.tab || 'home');

      // 글쓰기 / 상세 / 목록 상태 정리
      if (state.writing) {
        setIsWriting(true);
        setEditingPost(null);
        setSelectedPostId(null);
      } else if (state.postId) {
        setIsWriting(false);
        setEditingPost(null);
        setSelectedPostId(state.postId);
      } else {
        setIsWriting(false);
        setEditingPost(null);
        setSelectedPostId(null);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [activeTab, setActiveTab] = useState<string>('home');
  const [isWriting, setIsWriting] = useState(false);
  const [writingType, setWritingType] = useState<BoardType | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // 상세 페이지 진입(특히 새로고침/딥링크) 시 content/attachments가 비어있으면 단건 로드
  // - 목록 로드는 트래픽 절감을 위해 최소 필드만 가져오므로, 새로고침하면 (내용 없음)으로 보일 수 있음
  const detailPrefetchedRef = useRef<Record<string, boolean>>({});
  const detailPrefetchingRef = useRef<Record<string, boolean>>({});
  
  // 모달 상태 관리
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [showApprovalPending, setShowApprovalPending] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  const [adminPassword, setAdminPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [memberLoginLoading, setMemberLoginLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [userRole, setUserRole] = useState<UserRole>(() => (localStorage.getItem('union_role') as UserRole) || 'guest');
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(() => localStorage.getItem('union_is_admin') === 'true');
  const [loggedInMember, setLoggedInMember] = useState<Member | null>(() => {
    const saved = localStorage.getItem('union_member');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });

  // -------------------------------------------------
  // ✅ 권한 가드
  // - 게스트(로그아웃): 공지사항/자유게시판/자료실 접근 불가
  // - 조합원: 공지사항 보기 가능, 글쓰기는 자유게시판/자료실만 가능
  // - 관리자: 전체 가능
  // (hash/#tab=... 직접 접근도 막기 위해 App 레벨에서 한 번 더 가드)
  // -------------------------------------------------
  useEffect(() => {
    if (userRole !== 'guest') return;

    const guestRestricted = new Set([
      'notice',
      'notice_all',
      'family_events',
      'dispatch',
      'dispatch_jinkwan',
      'dispatch_dobong',
      'dispatch_songpa',
      'free',
      'questions',
      'resources',
    ]);
    if (!guestRestricted.has(activeTab)) return;

    // 회원 전용 안내 팝업 + 홈으로 돌려보내기
    setShowApprovalPending(true);
    setActiveTab('home');
    setIsWriting(false);
    setWritingType(null);
    setEditingPost(null);
    setSelectedPostId(null);
    replaceNav({ tab: 'home', postId: null, writing: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, activeTab]);

  useEffect(() => {
    if (!isWriting) return;

    const targetType = ((writingType || (activeTab === 'notice' ? 'notice_all' : activeTab)) as any) as string;

    // 게스트는 어떤 글쓰기 화면도 접근 불가
    if (userRole === 'guest') {
      setShowApprovalPending(true);
      setIsWriting(false);
      setWritingType(null);
      setEditingPost(null);
      replaceNav({ tab: activeTab, postId: null, writing: false });
      return;
    }

    // 공고/공지, 경조사 글쓰기는 관리자만
    if (['notice_all', 'family_events'].includes(targetType) && userRole !== 'admin') {
      setIsWriting(false);
      setWritingType(null);
      setEditingPost(null);
      setShowAdminLogin(true);
      replaceNav({ tab: activeTab, postId: null, writing: false });
      return;
    }
  }, [isWriting, writingType, activeTab, userRole]);
  
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SETTINGS);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [deletedPosts, setDeletedPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // -----------------------------
  // 조합원 홈 온보딩(푸시 알림 받기)
  // - 승인 완료 + 로그인한 조합원에게만 노출
  // - "나중에"를 누르면 1일 후 다시 노출
  // - "알림 받기" 성공 시 영구적으로 숨김
  // -----------------------------
  const [showPushOnboarding, setShowPushOnboarding] = useState(false);
  // 로그인할 때마다: 푸시 알림이 꺼져 있으면 안내 팝업
  const [showPushLoginPrompt, setShowPushLoginPrompt] = useState(false);
  const [pushPromptName, setPushPromptName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 홈 화면 + 로그인 조합원만
    if (activeTab !== 'home') {
      setShowPushOnboarding(false);
      return;
    }
    if (userRole !== 'member' || !loggedInMember?.id) {
      setShowPushOnboarding(false);
      return;
    }

    // 승인 완료 여부(세션 복원 로직상 member는 승인 완료지만, 안전하게 한 번 더 체크)
    if (loggedInMember?.isApproved === false) {
      setShowPushOnboarding(false);
      return;
    }

    const memberId = loggedInMember.id;
    const doneKey = `union_push_onboard_done_${memberId}`;
    const dismissKey = `union_push_onboard_dismiss_${memberId}`;

    const done = localStorage.getItem(doneKey) === '1';
    if (done) {
      setShowPushOnboarding(false);
      return;
    }

    const dismissTs = Number(localStorage.getItem(dismissKey) || '0');
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (dismissTs && Date.now() - dismissTs < DAY_MS) {
      setShowPushOnboarding(false);
      return;
    }

    setShowPushOnboarding(true);
    setShowPushLoginPrompt(false);
  }, [activeTab, userRole, loggedInMember?.id, loggedInMember?.isApproved]);

  const markPushOnboardingDone = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!loggedInMember?.id) return;
    const memberId = loggedInMember.id;
    localStorage.setItem(`union_push_onboard_done_${memberId}`, '1');
    localStorage.removeItem(`union_push_onboard_dismiss_${memberId}`);
    setShowPushOnboarding(false);
  }, [loggedInMember?.id]);

  const promptPushIfOff = async (name?: string) => {
    try {
      const supported = await isPushSupported();
      if (!supported) return;


      // 가입승인 완료 온보딩 팝업이 뜰 예정이면(첫 로그인 등), 로그인 안내 팝업은 띄우지 않음
      if (userRole === 'member' && loggedInMember?.id && loggedInMember?.isApproved !== false) {
        const memberId = loggedInMember.id;
        const doneKey = `union_push_onboard_done_${memberId}`;
        const dismissKey = `union_push_onboard_dismiss_${memberId}`;
        const done = localStorage.getItem(doneKey) === '1';
        const dismissTs = Number(localStorage.getItem(dismissKey) || '0');
        const DAY_MS = 24 * 60 * 60 * 1000;
        const dismissedRecently = dismissTs && Date.now() - dismissTs < DAY_MS;
        if (!done && !dismissedRecently) return;
      }
      const status = await getClientPushStatus();
      if (!status.enabled) {
        setPushPromptName(name);
        setShowPushLoginPrompt(true);
      }
    } catch (e) {
      // 체크 실패는 무시(로그인 흐름 방해 X)
      console.warn('[push] getClientPushStatus failed:', e);
    }
  };


  const dismissPushOnboardingForOneDay = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!loggedInMember?.id) return;
    const memberId = loggedInMember.id;
    localStorage.setItem(`union_push_onboard_dismiss_${memberId}`, String(Date.now()));
    setShowPushOnboarding(false);
  }, [loggedInMember?.id]);


  // -----------------------------
  // 브라우저 뒤로가기(History) 대응
  // - URL 경로는 그대로 두고(hash만 사용) 히스토리에 상태를 기록합니다.
  // - 뒤로가기/앞으로가기로 게시글 상세 <-> 목록, 탭 이동이 자연스럽게 동작합니다.
  // -----------------------------
  type NavState = { tab?: string; postId?: string | null; writing?: boolean };

  const buildHash = (s: NavState) => {
    const params = new URLSearchParams();
    if (s.tab) params.set('tab', s.tab);
    if (s.postId) params.set('post', s.postId);
    if (s.writing) params.set('write', '1');
    const q = params.toString();
    return q ? `#${q}` : '';
  };

  const readHash = (): NavState => {
    const raw = (window.location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const tab = params.get('tab') || undefined;
    const postId = params.get('post');
    const writing = params.get('write') === '1';
    return { tab, postId: postId || null, writing };
  };

  const pushNav = (s: NavState) => {
    try {
      window.history.pushState(s, '', window.location.pathname + buildHash(s));
    } catch {
      // ignore
    }
  };

  const replaceNav = (s: NavState) => {
    try {
      window.history.replaceState(s, '', window.location.pathname + buildHash(s));
    } catch {
      // ignore
    }
  };

  // ✅ 목록용 fetchPostsFromCloud()는 트래픽 절감을 위해 content/attachments/comments를 비우는 경우가 있음.
  // 포커스 전환/화면 재개 시 syncData()가 목록을 다시 받으면서,
  // 이미 상세에서 로드해 둔 content가 덮어써져 (내용 없음)으로 보이는 문제가 생길 수 있다.
  // -> 새 목록을 적용할 때, 이전 state에 상세 필드가 있으면 보존한다.
  const mergePostsPreserveDetail = useCallback((prev: Post[], fresh: Post[]) => {
    if (!Array.isArray(fresh)) return prev;
    const prevMap = new Map(prev.map((p) => [p.id, p]));
    return fresh.map((f) => {
      const p = prevMap.get(f.id);
      if (!p) return f;
      const keepContent = (!f.content || f.content.trim() === '') && (p.content && p.content.trim() !== '');
      const keepAttachments = (!f.attachments || f.attachments.length === 0) && (p.attachments && p.attachments.length > 0);
      const keepComments = (!f.comments || f.comments.length === 0) && (p.comments && p.comments.length > 0);
      if (!keepContent && !keepAttachments && !keepComments) return { ...p, ...f };
      return {
        ...p,
        ...f,
        content: keepContent ? p.content : f.content,
        attachments: keepAttachments ? p.attachments : f.attachments,
        comments: keepComments ? p.comments : f.comments,
      } as Post;
    });
  }, []);

  // ---------------------------------------------
  // 배차표(트래픽 관리): 업로드 후 120시간(5일) 지난 글 자동 정리
  // - Supabase RLS 정책에 따라 삭제가 실패할 수 있으므로 best-effort로 처리
  // - 앱이 죽지 않도록 항상 조용히 실패 처리
  // ---------------------------------------------
  const DISPATCH_TTL_MS = 120 * 60 * 60 * 1000;
  const pruneExpiredDispatchPosts = useCallback((list: Post[]) => {
    const now = Date.now();
    const expiredIds: string[] = [];
    const next = (Array.isArray(list) ? list : []).filter((p) => {
      const t = (p?.type || '') as string;
      if (!t.startsWith('dispatch_')) return true;
      const ts = new Date(p?.createdAt || '').getTime();
      if (!ts || Number.isNaN(ts)) return true; // createdAt 없으면 보존
      const expired = now - ts > DISPATCH_TTL_MS;
      if (expired) expiredIds.push(p.id);
      return !expired;
    });

    // 클라우드에서도 best-effort 삭제
    if (expiredIds.length && cloud.isSupabaseEnabled()) {
      expiredIds.forEach((id) => {
        cloud.deletePostFromCloud(id).catch(() => {});
      });
    }

    return next;
  }, []);

  const syncData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      if (cloud.isSupabaseEnabled()) {
        // NOTE:
        // - site_settings.data can become very large if an image (base64) is stored in it.
        // - Our app refreshes on focus/visibility to keep posts/members up to date.
        //   We MUST avoid re-downloading heavy settings on every refresh.

        if (showLoading || !settings) {
          const [pData, mData, sData] = await Promise.all([
            cloud.fetchPostsFromCloud(),
            cloud.fetchMembersFromCloud(),
            cloud.fetchSettingsFromCloud(),
          ]);

          if (pData) setPosts((prev) => pruneExpiredDispatchPosts(mergePostsPreserveDetail(prev, pData)));
          if (mData) {
            setMembers(mData);
            localStorage.setItem('union_members', JSON.stringify(mData));
          }
          if (sData) setSettings(sData);
        } else {
          // Lightweight refresh (posts + members only)
          const [pData, mData] = await Promise.all([
            cloud.fetchPostsFromCloud(),
            cloud.fetchMembersFromCloud(),
          ]);
          if (pData) setPosts((prev) => pruneExpiredDispatchPosts(mergePostsPreserveDetail(prev, pData)));
          if (mData) {
            setMembers(mData);
            localStorage.setItem('union_members', JSON.stringify(mData));
          }
        }
      } else {
        const sPosts = localStorage.getItem('union_posts');
        const sMembers = localStorage.getItem('union_members');
        const sSettings = localStorage.getItem('union_settings');
        if (sPosts) setPosts(pruneExpiredDispatchPosts(JSON.parse(sPosts)));
        if (sMembers) setMembers(JSON.parse(sMembers));
        if (sSettings) setSettings(JSON.parse(sSettings));
      }
    } catch (e) {
      console.error('데이터 동기화 오류:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    syncData();
  }, [syncData]);

  // Supabase Auth 세션 복원 (새로고침/재방문 대비)
  useEffect(() => {
    const initAuth = async () => {
      if (!cloud.isSupabaseEnabled()) return;

      const session = await cloud.getAuthSession();
      const user = session?.user;
      if (!user) return;

      const profile = await cloud.fetchMemberByIdFromCloud(user.id);
      // 승인되지 않았거나 프로필이 없으면 즉시 로그아웃 처리
      if (!profile || !profile.isApproved) {
        await cloud.signOut();
        setUserRole('guest');
        setLoggedInMember(null);
        localStorage.removeItem('union_role');
        localStorage.removeItem('union_member');
        return;
      }

      setUserRole('member');
      setLoggedInMember(profile);
      localStorage.setItem('union_role', 'member');
      const { password, ...sessionData } = profile as any;
      localStorage.setItem('union_member', JSON.stringify(sessionData));
    };
    initAuth();
  }, []);

  // 비밀번호 재설정(Recovery) 이벤트 처리
  useEffect(() => {
    if (!cloud.isSupabaseEnabled()) return;

    // redirectTo에 ?reset=1 을 붙여두면, 링크 클릭 후 앱이 어떤 화면을 보여줘야 하는지 알 수 있습니다.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('reset') === '1') {
        setShowResetPassword(true);
      }
    } catch {
      // ignore
    }

    const { data } = cloud.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowMemberLogin(false);
        setShowForgotPassword(false);
        setShowResetPassword(true);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  const saveToLocal = (key: string, data: any) => {
    try {
      localStorage.setItem(`union_${key}`, JSON.stringify(data));
    } catch (e) {
      // localStorage 용량 초과 등으로 저장 실패해도 앱이 죽지 않도록 무시
      console.warn('localStorage 저장 실패:', e);
    }
  };

const invalidateMembersCache = () => {
  try {
    localStorage.removeItem('union_members');
    localStorage.setItem('union_members_dirty_at', String(Date.now()));
  } catch {}
};


  const handleTabChange = (tab: string) => {
    // 탭 그대로 이동
    // - 모바일: notice는 공지사항 랜딩(하위메뉴만 노출)
    // - 데스크톱: notice는 공고/공지( notice_all )로 이동 (상단 메뉴에서 경조사 분리)
    let nextTab = tab;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    // 데스크톱: 공지사항 탭은 공고/공지( notice_all )로 바로 이동
    if (isDesktop && nextTab === 'notice') nextTab = 'notice_all';
    // 제한된 메뉴(게스트): 공지사항(공고/공지, 경조사 포함), 자유게시판, 자료실
    // - 모바일: notice(랜드)도 차단
    const restrictedTabs = [
      'notice',
      'notice_all',
      'family_events',
      'dispatch',
      'dispatch_jinkwan',
      'dispatch_dobong',
      'dispatch_songpa',
      'free',
      'questions',
      'resources',
    ];
    
    if (userRole === 'guest' && restrictedTabs.includes(nextTab)) {
      setShowApprovalPending(true);
      return;
    }
    
    setActiveTab(nextTab);
    setIsWriting(false);
    setWritingType(null);
    setEditingPost(null);
    setSelectedPostId(null);
    pushNav({ tab: nextTab, postId: null, writing: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePost = async (title: string, content: string, attachments?: PostAttachment[], id?: string) => {
    let targetPost: Post;
    if (id) {
      const existing = posts.find(p => p.id === id);
      // 수정 시 작성자 정보는 유지(레거시 호환)
      targetPost = { ...existing!, title, content, attachments };
    } else {
      const authorName = userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원');
      const authorId = userRole === 'admin' ? 'admin' : (loggedInMember?.id || undefined);
      targetPost = {
        id: Date.now().toString(),
        type: ((writingType || (activeTab === 'notice' ? 'notice_all' : activeTab)) as BoardType),
        title,
        content,
        author: authorName,
        authorId,
        createdAt: new Date().toISOString(),
        views: 0,
        attachments: attachments,
        comments: [],
        pinned: false,
        pinnedAt: null
      };
    }
    // --------------------------------------
    // ✅ 전 첨부파일(이미지/문서)을 Supabase Storage에 업로드하고 URL만 DB에 저장
    // - 기존: 문서 파일은 data URL(base64) 그대로 DB에 들어갈 수 있어 일반회원 저장 시 실패 가능
    // - 개선: data URL 첨부는 종류와 무관하게 모두 Storage로 올린 뒤 URL만 posts.attachments에 저장
    // --------------------------------------
    try {
      if (cloud.isSupabaseEnabled() && targetPost.attachments?.length) {
        const nextAtt = await Promise.all(
          targetPost.attachments.map(async (a) => {
            if (typeof a?.data === 'string' && a.data.startsWith('data:')) {
              return await cloud.uploadPostAttachment(targetPost.id, a);
            }
            return a;
          })
        );
        targetPost = { ...targetPost, attachments: nextAtt, content: targetPost.content || '' };
      }
    } catch (e) {
      console.error('첨부파일 Storage 업로드 실패:', e);
      alert('첨부파일 업로드에 실패했습니다. Supabase Storage 권한 또는 버킷 설정을 확인해주세요.');
      return;
    }

    try {
      const newPosts = id ? posts.map(p => p.id === id ? targetPost : p) : [targetPost, ...posts];
      await cloud.savePostToCloud(targetPost);
      setPosts(newPosts);
      saveToLocal('posts', newPosts);
      alert('성공적으로 저장되었습니다.');
    } catch (e) {
      console.error('게시글 저장 실패:', e);
      alert('게시글 저장에 실패했습니다. posts 테이블 RLS 정책과 첨부파일 권한을 다시 확인해주세요.');
      return;
    }
    setIsWriting(false);
    pushNav({ tab: activeTab, postId: null, writing: false });
    setEditingPost(null);
  };

  const handleSaveComment = async (postId: string, content: string, parentId?: string) => {
    if (userRole === 'guest') {
      setShowApprovalPending(true);
      return;
    }
    
    const newComment: Comment = {
      id: Date.now().toString(),
      author: userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원'),
      content,
      createdAt: new Date().toISOString(),
      replies: []
    };
    
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        let updatedPost;
        if (!parentId) {
          updatedPost = { ...post, comments: [...(post.comments || []), newComment] };
        } else {
          updatedPost = { 
            ...post, 
            comments: (post.comments || []).map(c => 
              c.id === parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c
            ) 
          };
        }
        cloud.savePostToCloud(updatedPost);
        return updatedPost;
      }
      return post;
    });
    
    setPosts(updatedPosts);
    saveToLocal('posts', updatedPosts);
  };


  const handleEditComment = async (postId: string, commentId: string, content: string, parentId?: string) => {
    if (userRole === 'guest') return;

    const updatedPosts = posts.map(post => {
      if (post.id !== postId) return post;

      const updatedComments = (post.comments || []).map(c => {
        if (!parentId) {
          if (c.id !== commentId) return c;
          const updated = { ...c, content };
          return updated;
        }

        // editing a reply
        if (c.id !== parentId) return c;
        const updatedReplies = (c.replies || []).map(r => (r.id === commentId ? { ...r, content } : r));
        return { ...c, replies: updatedReplies };
      });

      const updatedPost = { ...post, comments: updatedComments };
      cloud.savePostToCloud(updatedPost);
      return updatedPost;
    });

    setPosts(updatedPosts);
    saveToLocal('posts', updatedPosts);
  };

  const handleDeleteComment = async (postId: string, commentId: string, parentId?: string) => {
    if (userRole === 'guest') return;

    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    const updatedPosts = posts.map(post => {
      if (post.id !== postId) return post;

      let updatedComments: Comment[] = (post.comments || []);

      if (!parentId) {
        updatedComments = updatedComments.filter(c => c.id !== commentId);
      } else {
        updatedComments = updatedComments.map(c => {
          if (c.id !== parentId) return c;
          const updatedReplies = (c.replies || []).filter(r => r.id !== commentId);
          return { ...c, replies: updatedReplies };
        });
      }

      const updatedPost = { ...post, comments: updatedComments };
      cloud.savePostToCloud(updatedPost);
      return updatedPost;
    });

    setPosts(updatedPosts);
    saveToLocal('posts', updatedPosts);
  };

  const handleDeletePost = async (postId: string) => {
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return;

    // ✅ 권한: 관리자 또는 작성자(조합원 본인)
    const isAuthor = userRole !== 'guest' && (
      (postToDelete.authorId && loggedInMember?.id && postToDelete.authorId === loggedInMember.id) ||
      (!postToDelete.authorId && (postToDelete.author === (loggedInMember?.name || '')))
    );
    if (userRole !== 'admin' && !isAuthor) {
      alert('작성자만 삭제할 수 있습니다.');
      return;
    }
    
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    const updatedPosts = posts.filter(p => p.id !== postId);
    setPosts(updatedPosts);
    setDeletedPosts([postToDelete, ...deletedPosts]);
    saveToLocal('posts', updatedPosts);
    await cloud.deletePostFromCloud(postId);
    
    setSelectedPostId(null);
    pushNav({ tab: activeTab, postId: null, writing: false });
    alert('삭제가 완료되었습니다.');
  };

  const handleTogglePinPost = async (post: Post, pinned: boolean) => {
    if (userRole !== 'admin') return;
    const updated: Post = {
      ...post,
      pinned,
      pinnedAt: pinned ? new Date().toISOString() : null,
    };

    const newPosts = posts.map(p => (p.id === post.id ? updated : p));
    setPosts(newPosts);
    saveToLocal('posts', newPosts);

    // 서버 저장 (모든 사용자에게 동일 적용)
    await cloud.setPostPinnedInCloud(post.id, pinned);
    await cloud.savePostToCloud(updated); // pinned 값 포함해 upsert (보강)
  };



// 휴지통에서 복구 / 영구삭제 (관리자)
const handleRestorePost = async (postId: string) => {
  const postToRestore = deletedPosts.find(p => p.id === postId);
  if (!postToRestore) return;

  const updatedDeleted = deletedPosts.filter(p => p.id !== postId);
  const updatedPosts = [postToRestore, ...posts];

  setPosts(updatedPosts);
  setDeletedPosts(updatedDeleted);

  saveToLocal('posts', updatedPosts);
  saveToLocal('deletedPosts', updatedDeleted);

  try {
    // 휴지통에서 복구 시 다시 클라우드에 저장
    cloud.savePostToCloud(postToRestore);
  } catch (e) {
    console.warn('restore cloud save failed', e);
  }

  alert('복구가 완료되었습니다.');
};

const handlePermanentDelete = (postId: string) => {
  if (!window.confirm('휴지통에서 영구삭제 하시겠습니까?')) return;

  const updatedDeleted = deletedPosts.filter(p => p.id !== postId);
  setDeletedPosts(updatedDeleted);
  saveToLocal('deletedPosts', updatedDeleted);

  // 이미 삭제 시점에 클라우드에서는 제거되어 있을 수 있으므로, 여기서는 목록에서만 제거합니다.
  alert('영구삭제가 완료되었습니다.');
};


  const handleSignup = async (
    memberData: Omit<Member, 'id' | 'signupDate' | 'isApproved' | 'password' | 'loginId'>,
    password: string
  ) => {
    if (!cloud.isSupabaseEnabled()) {
      throw new Error('Supabase 설정이 필요합니다. (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
    }

    // 1) Auth 계정 생성 (이메일/비밀번호)
    const { data, error } = await cloud.signUpWithEmail(memberData.email, password);
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error('회원가입(user) 정보가 생성되지 않았습니다. (이메일 인증 설정을 확인하세요)');

    // 2) members 테이블에 신청서 정보 저장 (id = auth.user.id)
    const newMember: Member = {
      id: user.id,
      name: memberData.name,
      birthDate: memberData.birthDate,
      phone: memberData.phone,
      email: memberData.email,
      garage: memberData.garage,
      signupDate: new Date().toISOString(),
      isApproved: false,
    };

    const updatedMembers = [newMember, ...members];
    setMembers(updatedMembers);
    saveToLocal('members', updatedMembers);
    
await cloud.saveMemberToCloud(newMember);

// 관리자에게 '가입 신청서 제출' 푸시 알림 (best-effort)
try {
  await notifyAdminSignup(newMember);
} catch (e) {
  console.warn('관리자 가입신청 푸시 알림 실패(무시):', e);
}

    // 가입 직후에는 승인 전이므로, 세션이 생성되어 있더라도 강제로 로그아웃 시켜두는 것이 안전합니다.
    await cloud.signOut();
  };

  const handleApproveMember = async (memberId: string) => {
    const updatedMembers = members.map(m => m.id === memberId ? { ...m, isApproved: true } : m);
    setMembers(updatedMembers);
    saveToLocal('members', updatedMembers);
    
    const approvedMember = updatedMembers.find(m => m.id === memberId);
    if (approvedMember) {
      await cloud.saveMemberToCloud(approvedMember);
      alert(`${approvedMember.name}님의 가입이 승인되었습니다.`);
    }
  };

  const handleRemoveMemberByAdmin = async (memberId: string) => {
    const memberToRemove = members.find(m => m.id === memberId);
    if (!memberToRemove) return;
    
    if (!window.confirm(`${memberToRemove.name} 조합원을 강제 탈퇴 처리하시겠습니까?`)) return;

    const updatedMembers = members.filter(m => m.id !== memberId);
    setMembers(updatedMembers);
    saveToLocal('members', updatedMembers);

// 관리자 강제 탈퇴 처리 시에도 관리자에게 푸시 알림 (best-effort)
try {
  await notifyAdminWithdraw(memberToRemove);
} catch (e) {
  console.warn('관리자 강제탈퇴 푸시 알림 실패(무시):', e);
}

await cloud.deleteMemberFromCloud(memberId);
    alert('정상적으로 처리되었습니다.');
  };

  const handleUpdateSettings = async (newSettings: SiteSettings) => {
    setSettings(newSettings);
    saveToLocal('settings', newSettings);
    await cloud.saveSettingsToCloud(newSettings);
  };

  const handleAdminLogin = async () => {
    if (adminPassword === '1229') {
      setIsAdminAuth(true);
      setUserRole('admin');
      localStorage.setItem('union_role', 'admin');
      localStorage.setItem('union_is_admin', 'true');
      setShowAdminLogin(false);
      setAdminPassword('');
      alert('관리자 모드로 접속되었습니다.');

      // 관리자도 로그인 후 푸시 알림 상태 체크
      await promptPushIfOff();
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  
  const isAbortLikeError = (err: any) => {
    const msg = String(err?.message || '');
    return err?.name === 'AbortError' || /aborted|abort|signal is aborted/i.test(msg);
  };

const handleMemberLogin = async () => {
    if (memberLoginLoading) return; // 중복 클릭 방지
    if (!loginEmail) return alert('이메일 주소를 입력해주세요.');
    if (!loginPassword) return alert('비밀번호를 입력해주세요.');
    if (!cloud.isSupabaseEnabled()) return alert('Supabase 설정이 필요합니다.');

    setMemberLoginLoading(true);
    try {
      const { data, error } = await cloud.signInWithEmailPassword(loginEmail, loginPassword);
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('로그인 정보(user)를 확인할 수 없습니다.');

      const profile = await cloud.fetchMemberByIdFromCloud(user.id);

      // 가입신청서가 없거나 미승인인 경우: 로그인은 되더라도 즉시 차단 + 로그아웃
      if (!profile || !profile.isApproved) {
        await cloud.signOut();
        setShowMemberLogin(false);
        setShowApprovalPending(true);
        return;
      }

      setUserRole('member');
      setLoggedInMember(profile);
      localStorage.setItem('union_role', 'member');
      const { password, ...sessionData } = profile as any;
      localStorage.setItem('union_member', JSON.stringify(sessionData));
      setShowMemberLogin(false);
      setLoginEmail('');
      setLoginPassword('');
      alert(`${profile.name}님, 환영합니다!`);

      // 로그인 후: 푸시 알림이 꺼져 있으면 안내 팝업
      await promptPushIfOff(profile.name);
    } catch (err: any) {
      console.error(err);

      // Abort(요청 취소) 계열은 사용자에게 더 친절하게 안내
      if (isAbortLikeError(err)) {
        alert('네트워크 요청이 중단되었습니다. 잠시 후 다시 시도해주세요.\n(로그인 버튼은 한 번만 눌러주세요 / 와이파이·데이터 상태 확인)');
        return;
      }

      alert(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setMemberLoginLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotEmail(loginEmail || '');
    setShowForgotPassword(true);
  };

  const handleSendResetEmail = async () => {
    if (forgotLoading) return;
    if (!forgotEmail) return alert('이메일 주소를 입력해주세요.');
    if (!cloud.isSupabaseEnabled()) return alert('Supabase 설정이 필요합니다.');

    try {
      setForgotLoading(true);
      const redirectTo = `${window.location.origin}/?reset=1`;
      const { error } = await cloud.requestPasswordResetEmail("");
      if (error) throw error;

      alert('입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다.\n메일함(스팸함 포함)을 확인해주세요.');
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '비밀번호 재설정 메일 발송 중 오류가 발생했습니다.');
    } finally {
      setForgotLoading(false);
    }
  };

  const clearResetFlagFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  const handleUpdatePassword = async () => {
    if (resetLoading) return;
    if (!newPassword || newPassword.length < 6) return alert('새 비밀번호를 6자 이상 입력해주세요.');
    if (newPassword !== newPasswordConfirm) return alert('비밀번호 확인이 일치하지 않습니다.');
    if (!cloud.isSupabaseEnabled()) return alert('Supabase 설정이 필요합니다.');

    try {
      setResetLoading(true);
      const { error } = await cloud.updateMyPassword(newPassword);
      if (error) throw error;

      alert('비밀번호가 변경되었습니다.\n보안을 위해 로그아웃 후 다시 로그인해 주세요.');
      await cloud.signOut();
      setUserRole('guest');
      setLoggedInMember(null);
      localStorage.removeItem('union_role');
      localStorage.removeItem('union_member');
      setShowResetPassword(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      clearResetFlagFromUrl();
      setShowMemberLogin(true);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    await cloud.signOut();
    setUserRole('guest');
    setLoggedInMember(null);
    setIsAdminAuth(false);
    localStorage.removeItem('union_role');
    localStorage.removeItem('union_is_admin');
    localStorage.removeItem('union_member');
    handleTabChange('home');
  };

  const YOUTUBE_LINKS = [
  { label: "한국brt축구단", url: "https://www.youtube.com/@brt4866" },
  { label: "김동걸TV", url: "https://www.youtube.com/@SeoulCityBusDriver" },
  { label: "겸손은 힘들다", url: "https://www.youtube.com/@gyeomsonisnothing" },
];

const handleRequestWithdraw = () => {
    if (userRole !== 'member' || !loggedInMember) {
      setShowApprovalPending(true);
      return;
    }
    setWithdrawPassword('');
    // 이메일은 자동 채우지 않음: 본인이 로그인 이메일을 직접 입력하도록 함
    setWithdrawEmail('');
    setShowWithdraw(true);
  };

  const handleConfirmWithdraw = async () => {
    if (withdrawLoading) return;
    if (!withdrawEmail?.trim()) return alert('이메일을 입력해주세요.');
    if (!withdrawEmail?.trim()) return alert('이메일을 입력해주세요.');
    if (!withdrawPassword) return alert('비밀번호를 입력해주세요.');
    if (!cloud.isSupabaseEnabled()) return alert('Supabase 설정이 필요합니다.');

    try {
      setWithdrawLoading(true);

      const session = await cloud.getAuthSession();
      const user = session?.user;
      const email = user?.email;
      if (!user || !email) throw new Error('로그인 정보를 확인할 수 없습니다.');

      const inputEmail = withdrawEmail.trim();
      if (inputEmail.toLowerCase() !== email.toLowerCase()) {
        throw new Error('탈퇴 이메일이 로그인 이메일과 다릅니다. 로그인 이메일을 입력해주세요.');
      }

      // 1) 비밀번호로 재확인(재로그인)
      const { error: reauthErr } = await cloud.signInWithEmailPassword(inputEmail, withdrawPassword);
      if (reauthErr) throw reauthErr;

      // 2) members 행 삭제(탈퇴 처리)

// 관리자에게 '회원 탈퇴' 푸시 알림 (best-effort)
try {
  const memberRecord =
    loggedInMember ||
    members.find((m) => m.id === user.id) ||
    ({ name: email, garage: '' } as any);
  await notifyAdminWithdraw(memberRecord);
} catch (e) {
  console.warn('관리자 탈퇴 푸시 알림 실패(무시):', e);
}

// 2) members 행 삭제(탈퇴 처리)
await cloud.deleteMemberFromCloud(user.id);

      // 3) 로그아웃 + 로컬 상태 정리
      await cloud.signOut();
      setUserRole('guest');
      setLoggedInMember(null);
      setIsAdminAuth(false);
      localStorage.removeItem('union_role');
      localStorage.removeItem('union_is_admin');
      localStorage.removeItem('union_member');
      setShowWithdraw(false);
      handleTabChange('home');

      alert('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '회원 탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleWriteClick = (specificType?: BoardType) => {
    const rawType = specificType || activeTab;
    const targetType = (rawType === 'notice' ? 'notice_all' : rawType) as any;
    // 공고/공지, 경조사는 관리자만 글쓰기 가능
    if (['notice_all', 'family_events'].includes(targetType as string) && userRole !== 'admin') {
      setShowAdminLogin(true);
      return;
    }
    if (userRole === 'guest') { 
      setShowApprovalPending(true);
      return; 
    }
    setWritingType(targetType as BoardType);
    setIsWriting(true);
    setSelectedPostId(null);
    pushNav({ tab: activeTab, postId: null, writing: true });
    pushNav({ tab: activeTab, postId: null, writing: true });
  };

  const handleEditClick = (post: Post) => {
    // ✅ 권한: 관리자 또는 작성자(조합원 본인)
    const isAuthor = userRole !== 'guest' && (
      (post.authorId && loggedInMember?.id && post.authorId === loggedInMember.id) ||
      (!post.authorId && (post.author === (loggedInMember?.name || '')))
    );
    if (userRole !== 'admin' && !isAuthor) {
      alert('작성자만 수정할 수 있습니다.');
      return;
    }
    setEditingPost(post);
    setWritingType(post.type);
    setIsWriting(true);
    setSelectedPostId(null);
    pushNav({ tab: activeTab, postId: null, writing: true });
  };

  const handleSelectPost = (id: string | null) => {
    setSelectedPostId(id);
    pushNav({ tab: activeTab, postId: id, writing: false });

    if (id) {
      // 1) UI에서 즉시 조회수 반영
      const updatedPosts = posts.map(p => {
        if (p.id === id) {
          const updated = { ...p, views: (p.views || 0) + 1 };
          // ✅ 조회수만 가볍게 업데이트 (전체 row upsert 금지: 트래픽 폭증 원인)
          cloud.updatePostViewsInCloud(id, updated.views || 0);
          return updated;
        }
        return p;
      });
      setPosts(updatedPosts);
      saveToLocal('posts', updatedPosts);

      // 2) 상세 화면에서 필요한 큰 필드(content/attachments/comments)는 단건으로 추가 로드
      if (cloud.isSupabaseEnabled()) {
        cloud.fetchPostByIdFromCloud(id).then((full) => {
          if (!full) return;
          setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...full } : p)));
        }).catch(() => {});
      }
    }
  };

  // ✅ 새로고침/딥링크로 바로 상세에 진입하면,
  // 목록 로드(posts)는 최소 필드만 가져오므로 content가 비어 (내용 없음)으로 보일 수 있음.
  // selectedPostId가 있을 때 단건 조회로 content/attachments/comments를 채워준다.
  useEffect(() => {
    if (!selectedPostId) return;
    if (isWriting) return;
    if (!cloud.isSupabaseEnabled()) return;

    const current = posts.find((p) => p.id === selectedPostId);
    // 목록 fetch는 content를 안 가져오므로, content가 없으면 단건 조회 필요
    const needsFull = !current || !current.content;

    // 이미 성공적으로 채웠으면 다시 안 함
    if (!needsFull || detailPrefetchedRef.current[selectedPostId]) return;
    if (detailPrefetchingRef.current[selectedPostId]) return;
    detailPrefetchingRef.current[selectedPostId] = true;

    cloud
      .fetchPostByIdFromCloud(selectedPostId)
      .then((full) => {
        if (!full) return;
        detailPrefetchedRef.current[selectedPostId] = true;
        setPosts((prev) => {
          const idx = prev.findIndex((p) => p.id === selectedPostId);
          if (idx === -1) return [full, ...prev];
          const next = [...prev];
          next[idx] = { ...next[idx], ...full } as any;
          return next;
        });
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        detailPrefetchingRef.current[selectedPostId] = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostId, isWriting, posts]);

  const handleViewPostFromAdmin = (postId: string, type: BoardType) => {
    setActiveTab(type);
    handleSelectPost(postId);
    window.scrollTo(0, 0);
  };


  useEffect(() => {
    if (!cloud.isSupabaseEnabled()) return;
  
    const refresh = () => syncData(false);
  
    window.addEventListener('focus', refresh);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
  
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-primary rounded-full animate-spin mb-6"></div>
        <p className="text-gray-400 font-bold text-sm tracking-widest animate-pulse">우리노동조합 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <Layout settings={settings}>
      <Navbar 
        siteName={settings.siteName} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        userRole={userRole} 
        memberName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '')} 
        onToggleLogin={userRole === 'guest' ? () => setShowMemberLogin(true) : handleLogout}
        youtubeLinks={YOUTUBE_LINKS}
        showWithdrawButton={userRole === 'member' || userRole === 'admin'}
        onRequestWithdraw={handleRequestWithdraw}
      />
      
      <main className="flex-grow">
        {isWriting ? (
          <PostEditor 
            type={writingType || (activeTab as BoardType)} 
            initialPost={editingPost} 
            onSave={handleSavePost} 
            onCancel={() => { setIsWriting(false); setEditingPost(null); pushNav({ tab: activeTab, postId: null, writing: false }); }} 
          />
        ) : activeTab === 'admin' ? (
          isAdminAuth ? (
            <AdminPanel 
              settings={settings} 
              setSettings={handleUpdateSettings} 
              members={members} 
              posts={posts} 
              deletedPosts={deletedPosts} 
              onRestorePost={handleRestorePost} 
              onPermanentDelete={handlePermanentDelete} 
              onEditPost={handleEditClick} 
              onViewPost={handleViewPostFromAdmin} 
              onClose={() => handleTabChange('home')} 
              onRemoveMember={handleRemoveMemberByAdmin} 
              onApproveMember={handleApproveMember}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-40">
              <i className="fas fa-lock text-4xl text-gray-200 mb-6"></i>
              <button onClick={() => setShowAdminLogin(true)} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">관리자 인증</button>
            </div>
          )
        ) : activeTab === 'home' ? (
          <>
            {showPushOnboarding && (
              <PushOnboardingCard
                memberName={loggedInMember?.name}
                onDone={markPushOnboardingDone}
                onLater={dismissPushOnboardingForOneDay}
              />
            )}
            {showPushLoginPrompt && !showPushOnboarding && (
              <PushOnboardingCard
                variant="reminder"
                memberName={pushPromptName}
                onDone={() => setShowPushLoginPrompt(false)}
                onLater={() => setShowPushLoginPrompt(false)}
              />
            )}
            <Hero
              title={settings.heroTitle}
              subtitle={settings.heroSubtitle}
              imageUrls={settings.heroImageUrls || [settings.heroImageUrl]}
              onJoinClick={() => handleTabChange('signup')}
            />
          </>
        ) : ['intro', 'greeting', 'history', 'map'].includes(activeTab) ? (
          <Introduction settings={settings} activeTab={activeTab} />
        ) : activeTab === 'signup' ? (
          <SignupForm onGoHome={() => handleTabChange('home')} onSignup={handleSignup} />
        ) : activeTab === 'notice' ? (
          <>
            {/* 모바일: 공고/공지 / 경조사 메뉴만 노출 */}
            <div className="md:hidden">
              <NoticeLanding onSelect={handleTabChange} />
            </div>

            {/* 데스크톱: 공지사항은 공고/공지 게시판 단독 노출 */}
            <div className="hidden md:block">
              <NoticeSingle
                posts={posts}
                userRole={userRole}
                type={'notice_all'}
                selectedPostId={selectedPostId}
                onWriteClick={handleWriteClick}
                onEditClick={handleEditClick}
                onSelectPost={handleSelectPost}
                onDeletePost={handleDeletePost}
                onSaveComment={handleSaveComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                currentUserName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원')}
                currentUserId={userRole === 'admin' ? 'admin' : (loggedInMember?.id || '')}
              />
            </div>
          </>
) : ['notice_all', 'family_events'].includes(activeTab) ? (
          <>
            {/* 모바일: 선택한 하위 게시판만 단독으로 */}
            <div className="md:hidden">
              <NoticeSingle
                posts={posts}
                userRole={userRole}
                type={activeTab as BoardType}
                selectedPostId={selectedPostId}
                onWriteClick={handleWriteClick}
                onEditClick={handleEditClick}
                onSelectPost={handleSelectPost}
                onDeletePost={handleDeletePost}
                onSaveComment={handleSaveComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                currentUserName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원')}
                currentUserId={userRole === 'admin' ? 'admin' : (loggedInMember?.id || '')}
              />
            </div>

            {/* 데스크톱: 선택한 하위 게시판만 단독으로 */}
            <div className="hidden md:block">
              <NoticeSingle
                posts={posts}
                userRole={userRole}
                type={activeTab as BoardType}
                selectedPostId={selectedPostId}
                onWriteClick={handleWriteClick}
                onEditClick={handleEditClick}
                onSelectPost={handleSelectPost}
                onDeletePost={handleDeletePost}
                onSaveComment={handleSaveComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                currentUserName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원')}
                currentUserId={userRole === 'admin' ? 'admin' : (loggedInMember?.id || '')}
              />
            </div>
          </>
        ) : activeTab === 'dispatch' ? (
          <DispatchLanding onSelect={handleTabChange} />
        ) : ['dispatch_jinkwan', 'dispatch_dobong', 'dispatch_songpa'].includes(activeTab) ? (
          <div className="relative">
            <Board
              key={`${activeTab}:${selectedPostId || 'list'}:${isWriting ? 'w' : 'r'}`}
              type={activeTab as BoardType}
              posts={posts}
              onWriteClick={handleWriteClick}
              onEditClick={handleEditClick}
              selectedPostId={selectedPostId}
              onSelectPost={handleSelectPost}
              userRole={userRole}
              onDeletePost={handleDeletePost}
              onTogglePin={handleTogglePinPost}
              onSaveComment={handleSaveComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              currentUserName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원')}
              currentUserId={userRole === 'admin' ? 'admin' : (loggedInMember?.id || '')}
            />
          </div>
        ) : (
          <div className="relative">
            <Board 
              key={`${activeTab}:${selectedPostId || 'list'}:${isWriting ? 'w' : 'r'}`}
              type={activeTab as BoardType} 
              posts={posts} 
              onWriteClick={handleWriteClick} 
              onEditClick={handleEditClick} 
              selectedPostId={selectedPostId} 
              onSelectPost={handleSelectPost} 
              userRole={userRole} 
              onDeletePost={handleDeletePost} 
              onTogglePin={handleTogglePinPost}
              onSaveComment={handleSaveComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              currentUserName={userRole === 'admin' ? '관리자' : (loggedInMember?.name || '조합원')} 
              currentUserId={userRole === 'admin' ? 'admin' : (loggedInMember?.id || '')}
            />
          </div>
        )}
      </main>

      {/* 관리자 인증 모달 */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] p-12 max-w-[340px] w-[90%] shadow-2xl relative text-center">
            <button onClick={() => setShowAdminLogin(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"><i className="fas fa-times text-xl"></i></button>
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6"><i className="fas fa-key text-gray-900 text-2xl"></i></div>
            <h3 className="text-xl font-black mb-2 text-gray-900">ADMIN AUTH</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-8">관리자 비밀번호를 입력하세요</p>
            <div className="space-y-4">
              <input type="password" name="admin_pass" className="w-full border-2 border-gray-50 rounded-2xl p-4 text-center text-2xl tracking-[0.5em] focus:border-sky-primary outline-none transition-all bg-gray-50/50" autoFocus value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} />
              <button onClick={handleAdminLogin} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl">인증하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 조합원 로그인 모달 */}
      {showMemberLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] p-10 max-w-[360px] w-[90%] shadow-2xl relative">
            <button onClick={() => setShowMemberLogin(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"><i className="fas fa-times text-xl"></i></button>
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-sky-50 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm shadow-sky-100"><i className="fas fa-user-check text-sky-primary text-2xl"></i></div>
              <h3 className="text-2xl font-black text-gray-900">조합원 로그인</h3>
              <p className="text-[11px] text-gray-400 font-bold mt-2 tracking-tight">이메일 주소와 비밀번호를 입력하세요</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Email Address</label>
                <input type="email" placeholder="example@email.com" className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-sky-primary transition-colors bg-gray-50/50 font-bold" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Password</label>
                <input type="password" placeholder="••••••••" className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-sky-primary transition-colors bg-gray-50/50 font-bold" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !memberLoginLoading && handleMemberLogin()} />
              </div>
              <button
                onClick={handleMemberLogin}
                disabled={memberLoginLoading}
                className={`w-full px-10 py-4 bg-sky-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-sky-100 hover:opacity-95 active:scale-[0.99] transition-all mt-4 ${memberLoginLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {memberLoginLoading ? '로그인 중...' : '로그인'}
              </button>
              <button
                onClick={handleOpenForgotPassword}
                className="w-full text-center text-xs text-gray-400 font-bold hover:text-sky-primary mt-3 transition-colors"
              >
                비밀번호를 잊으셨나요? <span className="underline decoration-2 underline-offset-4 ml-1">재설정하기</span>
              </button>
              <button onClick={() => { handleTabChange('signup'); setShowMemberLogin(false); }} className="w-full text-center text-xs text-gray-400 font-bold hover:text-sky-primary mt-6 transition-colors">아직 회원이 아니신가요? <span className="underline decoration-2 underline-offset-4 ml-1">신규 가입하기</span></button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 메일 요청 모달 */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] p-10 max-w-[380px] w-[92%] shadow-2xl relative">
            <button onClick={() => setShowForgotPassword(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"><i className="fas fa-times text-xl"></i></button>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <i className="fas fa-envelope-open-text text-sky-primary text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">비밀번호 재설정</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                가입하신 이메일로 <span className="font-bold">재설정 링크</span>를 보내드릴게요.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-sky-primary transition-colors bg-gray-50/50 font-bold"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendResetEmail("")}
                  autoFocus
                />
              </div>

              <button
                onClick={handleSendResetEmail}
                className="w-full py-4 bg-sky-primary text-white rounded-2xl font-black text-base shadow-xl shadow-sky-100 hover:opacity-95 active:scale-95 transition-all"
                disabled={forgotLoading}
              >
                {forgotLoading ? '발송 중...' : '재설정 링크 보내기'}
              </button>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="w-full py-3 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors"
                disabled={forgotLoading}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* reset-password 페이지(모달) */}
      {showResetPassword && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] p-10 max-w-[420px] w-[92%] shadow-2xl relative">
            <button
              onClick={() => { setShowResetPassword(false); clearResetFlagFromUrl(); }}
              className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <i className="fas fa-key text-sky-primary text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">새 비밀번호 설정</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                새 비밀번호를 입력하신 후 저장을 눌러주세요.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">New Password</label>
                <input
                  type="password"
                  placeholder="6자 이상"
                  className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-sky-primary transition-colors bg-gray-50/50 font-bold"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Confirm Password</label>
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-sky-primary transition-colors bg-gray-50/50 font-bold"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdatePassword()}
                />
              </div>

              <button
                onClick={handleUpdatePassword}
                className="w-full py-4 bg-sky-primary text-white rounded-2xl font-black text-base shadow-xl shadow-sky-100 hover:opacity-95 active:scale-95 transition-all"
                disabled={resetLoading}
              >
                {resetLoading ? '저장 중...' : '비밀번호 저장'}
              </button>
              <button
                onClick={() => { setShowResetPassword(false); clearResetFlagFromUrl(); }}
                className="w-full py-3 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors"
                disabled={resetLoading}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 승인 대기 모달 */}
      {showApprovalPending && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] p-10 max-w-[360px] w-[90%] shadow-2xl relative text-center">
            <button onClick={() => setShowApprovalPending(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"><i className="fas fa-times text-xl"></i></button>
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><i className="fas fa-user-clock text-orange-400 text-3xl"></i></div>
            <h3 className="text-2xl font-black text-gray-900 mb-4">회원 전용 메뉴입니다</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
              회원 가입 후 <span className="text-orange-500 font-bold">승인</span>되면<br/>
              이용하실 수 있습니다.
            </p>
            <button 
              onClick={() => setShowApprovalPending(false)} 
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-base shadow-xl hover:bg-black transition-all active:scale-95"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 모달 */}
      {showWithdraw && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] p-10 max-w-[380px] w-[92%] shadow-2xl relative">
            <button
              onClick={() => {
                setShowWithdraw(false);
                setWithdrawEmail('');
                setWithdrawPassword('');
              }}
              className="absolute top-8 right-8 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <i className="fas fa-user-slash text-red-500 text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">회원 탈퇴</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                정말 탈퇴하시겠습니까?<br />
                탈퇴하면 <span className="font-bold">자유게시판·아무거나 질문·정보/자료 이용 권한</span>이 종료됩니다.<br />
                계속 진행하시려면 <span className="font-bold">이메일과 비밀번호</span>를 입력해 주세요.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Email</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  autoComplete="email"
                  className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-red-400 transition-colors bg-gray-50/50 font-bold"
                  value={withdrawEmail}
                  onChange={(e) => setWithdrawEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmWithdraw()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 ml-2 uppercase tracking-widest">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full border-2 border-gray-50 rounded-2xl p-4 text-sm outline-none focus:border-red-400 transition-colors bg-gray-50/50 font-bold"
                  value={withdrawPassword}
                  onChange={(e) => setWithdrawPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmWithdraw()}
                />
              </div>

              <button
                onClick={handleConfirmWithdraw}
                className="w-full py-4 bg-[#FF0000] text-white rounded-2xl font-black text-base shadow-xl hover:opacity-95 active:scale-95 transition-all"
                disabled={withdrawLoading}
              >
                {withdrawLoading ? '처리 중...' : '탈퇴하기'}
              </button>
              <button
                onClick={() => {
                  setShowWithdraw(false);
                  setWithdrawEmail('');
                  setWithdrawPassword('');
                }}
                className="w-full py-3 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors"
                disabled={withdrawLoading}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer
        siteName={settings.siteName}
        onTabChange={handleTabChange}
        youtubeLinks={YOUTUBE_LINKS}
        showWithdrawButton={userRole === 'member' || userRole === 'admin'}
        onRequestWithdraw={handleRequestWithdraw}
      />
    </Layout>
  );
};





export default App;
