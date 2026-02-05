
import React, { useMemo, useState, useEffect } from 'react';
import { enableNotifications } from '../pwa';
import { getNotificationPermission, unsubscribePush, isPushSupported } from '../services/pushService';
import { NAV_ITEMS } from '../constants';
import { UserRole } from '../types';

interface NavbarProps {
  siteName: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'guest' | 'member' | 'admin';
  memberName: string;
  onToggleLogin: () => void;
  youtubeLinks?: { label: string; url: string }[];
  showWithdrawButton?: boolean;
  onRequestWithdraw?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ siteName, activeTab, onTabChange, userRole, memberName, onToggleLogin, youtubeLinks = [], showWithdrawButton = false, onRequestWithdraw }) => {
  const activeParent = NAV_ITEMS.find(item => 
    item.id === activeTab || item.children?.some(child => child.id === activeTab)
  );

  // 모바일: 햄버거 드로어 내비
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const getLinkImageSrc = (label: string) => {
    const key = label.replace(/\s+/g, '');
    switch (key) {
      case '겸손은힘들다':
        return '/images/youtube-겸손은힘들다.png';
      case '김동걸TV':
        return '/images/youtube-김동걸TV.png';
      case '한국brt축구단':
        return '/images/youtube-한국brt축구단.png';
      default:
        return null;
    }
  };

  const mobileGroups = useMemo(() => {
    const intro = NAV_ITEMS.find(i => i.id === 'intro');
    const notice = NAV_ITEMS.find(i => i.id === 'notice');
    return [
      {
        id: 'intro',
        label: '조합소개',
        children: intro?.children || [
          { id: 'greeting', label: '인사말' },
          { id: 'history', label: '연혁' },
          { id: 'map', label: '찾아오시는 길' },
        ]
      },
      {
        id: 'notice',
        label: '공지사항',
        children: notice?.children || [
          { id: 'notice_all', label: '공고/공지' },
          { id: 'family_events', label: '경조사' },
        ]
      },
      { id: 'free', label: '자유게시판' },
      { id: 'resources', label: '자료실' },
      { id: 'admin', label: '설정' },
    ];
  }, [])


// 푸시 알림(조합원용)
const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
useEffect(() => {
  (async () => {
    try {
      const p = await getNotificationPermission();
      setNotifPerm(p);
    } catch {}
  })();
}, []);

const onEnableNoti = async () => {
  if (!isPushSupported()) {
    alert('이 브라우저는 푸시 알림을 지원하지 않습니다. (안드로이드 크롬 권장)');
    return;
  }
  const ok = await enableNotifications();
  const p = await getNotificationPermission();
  setNotifPerm(p);
  if (ok) alert('알림이 켜졌습니다! 이제 새 게시글이 올라오면 알림이 옵니다.');
  else alert('알림을 켜지 못했습니다. 브라우저 설정에서 알림을 허용했는지 확인해 주세요.');
};

const onDisableNoti = async () => {
  await unsubscribePush();
  const p = await getNotificationPermission();
  setNotifPerm(p);
  alert('알림을 껐습니다.');
};

  // 데스크톱: 공지사항(=공고/공지) / 경조사를 상단 메뉴로 분리
  const desktopNavItems = useMemo(() => {
    return NAV_ITEMS.flatMap((item) => {
      if (item.id !== 'notice') return [item];
      return [
        { ...item, id: 'notice_all', label: '공지사항' },
        { ...item, id: 'family_events', label: '경조사' },
      ];
    });
  }, []);
;

  const go = (tab: string) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const toggleGroup = (id: string) => {
    setOpenGroup(prev => (prev === id ? null : id));
  };

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      {/* 모바일 상단바 (햄버거) */}
      <div className="bg-white px-4 border-b border-gray-100 md:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="메뉴 열기"
          >
            <i className="fas fa-bars text-xl text-gray-800"></i>
          </button>

          <button onClick={() => onTabChange('home')} className="flex items-center">
            <i className="fas fa-users text-sky-primary text-lg mr-2"></i>
            <span className="font-black text-base tracking-tight text-gray-900">{siteName}</span>
          </button>

          {/* 모바일 우측: 로그인 사용자명 표시 (기존 설정 아이콘 자리) */}
          <div className="min-w-[48px] flex justify-end">
            {userRole !== 'guest' ? (
              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
                {memberName} <span className="text-gray-400 font-normal">님</span>
              </span>
            ) : (
              <div className="w-10" />
            )}
          </div>
        </div>
      </div>

      {/* 데스크톱 상단바 (기존 유지) */}
      <div className="bg-white px-4 border-b border-gray-100 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 md:h-18">
          <button 
            onClick={() => onTabChange('home')}
            className="flex items-center cursor-pointer relative group"
          >
            <i className="fas fa-users text-sky-primary text-xl md:text-2xl mr-2"></i>
            <span className="font-black text-lg md:text-xl tracking-tight text-gray-900">{siteName}</span>
          </button>

          <div className="flex items-center space-x-3">
            {userRole !== 'guest' && (
              <div className="flex items-center mr-2">
                <span className="text-[11px] md:text-xs font-bold text-gray-700">
                  {memberName} <span className="text-gray-400 font-normal">님</span>
                </span>
              </div>
            )}
            
            <button
              onClick={onToggleLogin}
              className={`text-[11px] md:text-xs px-4 py-2 rounded-full border transition-all whitespace-nowrap font-bold ${
                userRole !== 'guest' 
                  ? 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200' 
                  : 'bg-sky-primary text-white border-sky-primary hover:opacity-90 shadow-sm'
              }`}
            >
              {userRole === 'guest' ? '로그인' : '로그아웃'}
            </button>
            

{userRole !== 'guest' && (
  <button
    onClick={notifPerm === 'granted' ? onDisableNoti : onEnableNoti}
    className={`p-2.5 md:p-3 rounded-full hover:bg-gray-100 transition-colors ${
      notifPerm === 'granted' ? 'text-sky-primary' : 'text-gray-400'
    }`}
    title={notifPerm === 'granted' ? '알림 끄기' : '알림 켜기'}
  >
    <i className={`fas ${notifPerm === 'granted' ? 'fa-bell' : 'fa-bell-slash'} text-xl`}></i>
  </button>
)}

            <button
              onClick={() => onTabChange('admin')}
              className={`p-2.5 md:p-3 rounded-full hover:bg-gray-100 transition-colors ${activeTab === 'admin' ? 'text-sky-primary' : 'text-gray-400'}`}
              title="관리자 설정"
            >
              <i className="fas fa-cog text-xl"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 데스크톱 탭(기존 유지) */}
      <div className="bg-white px-2 md:px-4 border-b border-gray-50 hidden md:block">
        <div className="max-w-7xl mx-auto md:overflow-visible overflow-x-auto scrollbar-hide flex items-center h-14">
          <div className="flex space-x-1 md:space-x-2 h-full items-center min-w-max md:min-w-0 md:w-full md:justify-start">
            {desktopNavItems.map((item) => {
              const isActive = item.id === activeTab;
              const isSignup = item.id === 'signup';
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`${
                    isActive
                      ? 'text-sky-primary font-black'
                      : 'text-gray-500 hover:text-gray-800'
                  } px-2.5 md:px-5 py-2 text-[14px] md:text-base font-bold transition-all h-full border-b-2 ${
                    isActive ? 'border-sky-primary' : 'border-transparent'
                  } ${isSignup ? 'hidden sm:flex' : 'flex'} items-center whitespace-nowrap`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 데스크톱 하위 메뉴(기존 유지) */}
      {activeParent && activeParent.children && !(activeParent.id === 'notice' && (activeTab === 'notice_all' || activeTab === 'family_events')) && (
        <div className="hidden md:block bg-gray-50 px-4 animate-slideDown border-b border-gray-100">
          <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide flex items-center h-12">
            <div className="flex space-x-3 h-full items-center min-w-max">
              {activeParent.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onTabChange(child.id)}
                  className={`px-4 py-1.5 text-xs md:text-sm font-bold rounded-xl transition-all ${
                    activeTab === child.id 
                      ? 'bg-sky-primary text-white shadow-md' 
                      : 'text-gray-500 hover:text-sky-primary hover:bg-white'
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 모바일 드로어 메뉴 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-[82%] max-w-[360px] bg-white shadow-2xl flex flex-col">
            <div className="h-14 px-4 border-b flex items-center justify-between">
              <span className="font-black text-base text-gray-900">메뉴</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 -mr-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="닫기"
              >
                <i className="fas fa-times text-xl text-gray-700"></i>
              </button>
            </div>

            <div className="px-4 py-4 border-b bg-gray-50/50">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { onToggleLogin(); setMobileOpen(false); }}
                  className="py-3 rounded-2xl border bg-white font-black text-sm"
                >
                  {userRole === 'guest' ? '로그인' : '로그아웃'}
                </button>
                <button
                  onClick={() => go('signup')}
                  className="py-3 rounded-2xl border bg-white font-black text-sm"
                >
                  회원가입
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y">
                {mobileGroups.map((item) => {
                  const hasChildren = !!(item as any).children?.length;
                  const isOpen = openGroup === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => (hasChildren ? toggleGroup(item.id) : go(item.id))}
                        className="w-full px-4 py-5 flex items-center justify-between text-left"
                      >
                        <span className="text-[15px] font-black text-gray-900">{item.label}</span>
                        {hasChildren ? (
                          <i className={`fas ${isOpen ? 'fa-minus' : 'fa-plus'} text-gray-400`} />
                        ) : (
                          <i className="fas fa-chevron-right text-gray-300" />
                        )}
                      </button>

                      {hasChildren && isOpen && (
                        <div className="pb-3">
                          {(item as any).children.map((child: any) => (
                            <button
                              key={child.id}
                              onClick={() => go(child.id)}
                              className="w-full px-8 py-3 text-left text-sm font-bold text-gray-600 hover:bg-gray-50"
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
  </div>

  {/* 모바일 메뉴 하단: 유튜브 링크 + 회원탈퇴 */}
  <div
    className="border-t px-4 pt-4 pb-4 bg-white sticky bottom-0"
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
  >
    {youtubeLinks.length > 0 && (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-[360px] mx-auto">
        {youtubeLinks.slice(0, 4).map((it) => {
          const src = getLinkImageSrc(it.label);
          return (
            <a
              key={it.label}
              href={it.url}
              target="_blank"
              rel="noreferrer"
              className="w-full"
            >
              {src ? (
                <div className="w-full h-[60px] sm:h-[64px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 active:scale-[0.99] transition-all">
                  <img src={src} alt={it.label} className="w-full h-full object-contain" />
                </div>
              ) : (
                <span className="w-full h-[60px] sm:h-[64px] rounded-2xl text-white font-black text-sm shadow-md text-center flex items-center justify-center"
                      style={{ backgroundColor: "var(--point-color)" }}>
                  {it.label}
                </span>
              )}
            </a>
          );
        })}
        {showWithdrawButton && (
          <button
            type="button"
            onClick={() => { onRequestWithdraw?.(); setMobileOpen(false); }}
            className="w-full"
          >
            <div className="w-full h-[60px] sm:h-[64px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 active:scale-[0.99] transition-all">
              <img
                src="/images/youtube-회원탈퇴.png"
                alt="회원 탈퇴"
                className="w-full h-full object-contain"
              />
            </div>
          </button>
        )}
      </div>
    )}

    {youtubeLinks.length === 0 && showWithdrawButton && (
      <button
        type="button"
        onClick={() => { onRequestWithdraw?.(); setMobileOpen(false); }}
        className="w-full max-w-[360px] mx-auto"
      >
        <div className="w-full h-[60px] sm:h-[64px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 active:scale-[0.99] transition-all">
          <img
            src="/images/youtube-회원탈퇴.png"
            alt="회원 탈퇴"
            className="w-full h-full object-contain"
          />
        </div>
      </button>
    )}
</div>
</aside>
        </div>
      )}
      
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out forwards;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;
