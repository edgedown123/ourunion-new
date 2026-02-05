
import React, { useRef, useState, useMemo } from 'react';
import { SiteSettings, Member, Post, BoardType } from '../types';

interface AdminPanelProps {
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
  members: Member[];
  posts: Post[];
  deletedPosts: Post[];
  onRestorePost: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEditPost: (post: Post) => void;
  onViewPost: (id: string, type: BoardType) => void;
  onClose: () => void;
  onRemoveMember?: (id: string) => void;
  onApproveMember?: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  settings, setSettings, members, posts, deletedPosts, 
  onRestorePost, onPermanentDelete, onEditPost, onViewPost, onClose, onRemoveMember, onApproveMember
}) => {
  // 히어로 이미지 5장 관리를 위한 Refs
  const heroImageRefs = [
    useRef<HTMLInputElement>(null), 
    useRef<HTMLInputElement>(null), 
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];
  const greetingImageRef = useRef<HTMLInputElement>(null);
  const officeMapInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  
  const [adminTab, setAdminTab] = useState<'members' | 'intro' | 'offices' | 'posts' | 'storage' | 'push' | 'settings'>('members');
  const [openMemberActionId, setOpenMemberActionId] = useState<string | null>(null);
  const [openPostActionId, setOpenPostActionId] = useState<string | null>(null);
  const [activeOfficeId, setActiveOfficeId] = useState<string | null>(settings.offices[0]?.id || null);

  const [newYear, setNewYear] = useState('');
  const [newMonth, setNewMonth] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newText, setNewText] = useState('');

  // 날짜 포맷팅 유틸리티 함수
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}.${mm}.${dd}`;
  };


  // -----------------------------
  // 첨부파일(게시글 attachments) 사용량 계산
  // - attachments.data 는 dataURL(base64) 형태로 저장됩니다.
  // - base64를 실제로 디코딩하지 않고 길이로 대략 바이트를 계산합니다.
  // -----------------------------
  const dataUrlToBytes = (dataUrl: string): number => {
    if (!dataUrl) return 0;
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    let padding = 0;
    if (base64.endsWith('==')) padding = 2;
    else if (base64.endsWith('=')) padding = 1;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    const fixed = idx === 0 ? 0 : 1;
    return `${size.toFixed(fixed)}${units[idx]}`;
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('다운로드 실패:', e);
      alert('다운로드에 실패했습니다. (브라우저 보안 정책)');
    }
  };

  const boardLabel = (t: BoardType) => {
    switch (t) {
      case 'notice_all': return '공고/공지';
      case 'family_events': return '경조사';
      case 'free': return '자유게시판';
      case 'resources': return '자료실';
      case 'intro': return '소개';
      case 'signup': return '가입';
      case 'trash': return '휴지통';
      default: return t;
    }
  };

  const attachmentStats = useMemo(() => {
    const rows: Array<{
      postId: string;
      postTitle: string;
      postType: BoardType;
      postCreatedAt: string;
      fileName: string;
      mime: string;
      bytes: number;
      dataUrl: string;
    }> = [];

    for (const p of posts || []) {
      const list = p.attachments || [];
      for (const a of list) {
        const bytes = dataUrlToBytes(a.data);
        rows.push({
          postId: p.id,
          postTitle: p.title,
          postType: p.type,
          postCreatedAt: p.createdAt,
          fileName: a.name,
          mime: a.type,
          bytes,
          dataUrl: a.data,
        });
      }
    }

    const totalBytes = rows.reduce((s, r) => s + r.bytes, 0);
    const totalFiles = rows.length;
    const images = rows.filter(r => (r.mime || '').startsWith('image/'));
    const docs = rows.filter(r => !(r.mime || '').startsWith('image/'));

    const byBoard = new Map<BoardType, { bytes: number; files: number }>();
    for (const r of rows) {
      const cur = byBoard.get(r.postType) || { bytes: 0, files: 0 };
      cur.bytes += r.bytes;
      cur.files += 1;
      byBoard.set(r.postType, cur);
    }

    const boardRows = Array.from(byBoard.entries())
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.bytes - a.bytes);

    const topFiles = [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
    const largest = topFiles[0];

    return {
      rows,
      totalBytes,
      totalFiles,
      imageBytes: images.reduce((s, r) => s + r.bytes, 0),
      imageFiles: images.length,
      docBytes: docs.reduce((s, r) => s + r.bytes, 0),
      docFiles: docs.length,
      boardRows,
      topFiles,
      largest,
    };
  }, [posts]);


  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'heroImageUrl' | 'greetingImageUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setSettings({ ...settings, [field]: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const currentUrls = settings.heroImageUrls || [settings.heroImageUrl];
        const newUrls = [...currentUrls];
        // 배열 크기가 작으면 빈 문자열로 채워줌 (최대 5개)
        while (newUrls.length < 5) newUrls.push('');
        
        newUrls[index] = reader.result as string;
        
        // 첫 번째 사진은 heroImageUrl과도 동기화 (하위호환)
        if (index === 0) {
          setSettings({ ...settings, heroImageUrls: newUrls, heroImageUrl: newUrls[0] });
        } else {
          setSettings({ ...settings, heroImageUrls: newUrls });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearHeroImage = (index: number) => {
    const newUrls = [...(settings.heroImageUrls || [])];
    if (newUrls[index]) {
      newUrls[index] = '';
      setSettings({ ...settings, heroImageUrls: newUrls });
    }
  };

  const handleOfficeMapUpload = (e: React.ChangeEvent<HTMLInputElement>, officeId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updatedOffices = settings.offices.map(off => off.id === officeId ? { ...off, mapImageUrl: reader.result as string } : off);
        setSettings({ ...settings, offices: updatedOffices });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddHistory = () => {
    if (!newYear || !newText) return alert('연도와 내용은 필수로 입력해주세요.');
    let dateStr = `${newYear}년`;
    if (newMonth) dateStr += ` ${newMonth}월`;
    if (newDay) dateStr += ` ${newDay}일`;
    const updatedHistory = [{ year: dateStr, text: newText }, ...(settings.history || [])];
    setSettings({ ...settings, history: updatedHistory });
    setNewYear(''); setNewMonth(''); setNewDay(''); setNewText('');
  };

  const handleDeleteHistory = (index: number) => {
    const updatedHistory = settings.history.filter((_, i) => i !== index);
    setSettings({ ...settings, history: updatedHistory });
  };

  const handleDownloadExcel = () => {
    if (members.length === 0) return alert('다운로드할 명단이 없습니다.');
    const headers = ['성함', '연락처', '이메일', '차고지', '가입일', '승인상태'];
    const rows = members.map(m => [m.name, m.phone, m.email, m.garage, formatDate(m.signupDate), m.isApproved ? '승인' : '미승인']);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `우리노동조합_조합원명단.csv`;
    link.click();
  };

  const handleExportData = () => {
    const backupData = { settings, posts, members, deletedPosts, version: "1.2", date: new Date().toLocaleString() };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `우리노동조합_전체백업_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleDownloadAttachmentReportCSV = () => {
    const rows = attachmentStats.rows;
    if (!rows || rows.length === 0) return alert('첨부파일이 없습니다.');
    const headers = ['게시글ID', '게시판', '게시글제목', '게시글작성일', '파일명', 'MIME', '바이트', '용량'];
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        r.postId,
        boardLabel(r.postType),
        (r.postTitle || '').replace(/\n/g, ' ').replace(/,/g, ' '),
        r.postCreatedAt,
        (r.fileName || '').replace(/,/g, ' '),
        r.mime || '',
        String(r.bytes),
        formatFileSize(r.bytes),
      ].join(',')),
    ];
    const csvContent = "\uFEFF" + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `우리노동조합_첨부파일_사용량_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadAttachmentReportJSON = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalFiles: attachmentStats.totalFiles,
        totalBytes: attachmentStats.totalBytes,
        imageFiles: attachmentStats.imageFiles,
        imageBytes: attachmentStats.imageBytes,
        docFiles: attachmentStats.docFiles,
        docBytes: attachmentStats.docBytes,
      },
      byBoard: attachmentStats.boardRows.map(b => ({
        board: boardLabel(b.type),
        boardKey: b.type,
        files: b.files,
        bytes: b.bytes,
      })),
      files: attachmentStats.rows.map(r => ({
        postId: r.postId,
        boardKey: r.postType,
        board: boardLabel(r.postType),
        postTitle: r.postTitle,
        postCreatedAt: r.postCreatedAt,
        fileName: r.fileName,
        mime: r.mime,
        bytes: r.bytes,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `우리노동조합_첨부파일_사용량_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm('전체 데이터를 덮어씌우시겠습니까? 이 작업은 취소할 수 없습니다.')) {
          localStorage.setItem('union_settings', JSON.stringify(json.settings));
          localStorage.setItem('union_posts', JSON.stringify(json.posts));
          localStorage.setItem('union_members', JSON.stringify(json.members));
          localStorage.setItem('union_deleted_posts', JSON.stringify(json.deletedPosts || []));
          alert('데이터 복원이 완료되었습니다. 페이지를 새로고침합니다.');
          window.location.reload();
        }
      } catch (err) { alert('파일을 읽는 중 오류가 발생했습니다.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
        <div className="flex items-center flex-nowrap whitespace-nowrap">
          <div className="w-14 h-14 bg-sky-primary text-white rounded-2xl flex items-center justify-center mr-5 shadow-lg shadow-sky-100">
            <i className="fas fa-shield-alt text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">관리자 커맨드 센터</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
              Secure System Management
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-400">
          <i className="fas fa-times text-2xl"></i>
        </button>
      </div>

      <div className="flex space-x-1 mb-8 bg-gray-100/50 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide no-scrollbar">
        {[ 
          { id: 'members', label: '조합원 관리', icon: 'fa-users' }, 
          { id: 'intro', label: '인사말/소개 관리', icon: 'fa-info-circle' }, 
          { id: 'offices', label: '찾아오시는 길', icon: 'fa-map-marker-alt' }, 
          { id: 'posts', label: '게시글/휴지통', icon: 'fa-file-alt' }, 
          { id: 'storage', label: '첨부파일 사용량', icon: 'fa-paperclip' }, 
          { id: 'push', label: '푸시 알림', icon: 'fa-bell' }, 
          { id: 'settings', label: '시스템 설정', icon: 'fa-cog' } 
        ].map((tab) => (
          <button key={tab.id} onClick={() => setAdminTab(tab.id as any)} className={`flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${adminTab === tab.id ? 'bg-white text-sky-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            <i className={`fas ${tab.icon}`}></i><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {adminTab === 'members' && (
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden animate-fadeIn">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50/30 relative">
              <div><h3 className="text-xl font-black text-gray-900">가입 신청 명단</h3><p className="text-xs text-gray-400 mt-1 font-bold">현재 총 {members.length}명의 신청자가 있습니다.</p></div>
              <button onClick={handleDownloadExcel} className="absolute right-6 bottom-4 px-3 py-1.5 sm:px-6 sm:py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-50 hover:bg-emerald-700 transition-all text-[11px] sm:text-xs whitespace-nowrap sm:static sm:right-auto sm:bottom-auto sm:ml-4">내려받기</button>
            </div>
            
{/* 모바일 카드형 리스트 (sm 미만) */}
<div className="sm:hidden p-6 space-y-3">
  {members.length === 0 ? (
    <div className="py-16 text-center text-gray-400 font-bold italic">가입 신청 명단이 없습니다.</div>
  ) : (
    members.map(m => (
      <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-black text-gray-900 truncate">{m.name}</div>
              {m.isApproved ? (
                <span className="bg-sky-100 text-sky-600 text-[10px] px-2 py-0.5 rounded-full font-black whitespace-nowrap">승인됨</span>
              ) : (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-black whitespace-nowrap">미승인</span>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="text-gray-400 font-bold w-12 shrink-0">연락처</span>
                <span className="font-bold whitespace-nowrap break-keep">{String(m.phone ?? "").replace(/\s+/g, "")}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 font-bold w-12 shrink-0">이메일</span>
                <span className="truncate">{m.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 font-bold w-12 shrink-0">차고지</span>
                <span className="font-bold whitespace-nowrap break-keep">{m.garage}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 font-bold w-12 shrink-0">가입일</span>
                <span className="font-bold whitespace-nowrap">{formatDate(m.signupDate)}</span>
              </div>
            </div>
          </div>

          {/* 액션 정리: 더보기(⋯) 메뉴 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setOpenMemberActionId(openMemberActionId === m.id ? null : m.id)}
              className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 flex items-center justify-center font-black active:scale-95"
              aria-label="조합원 관리 메뉴"
            >
              ⋯
            </button>

            {openMemberActionId === m.id && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-20">
                {!m.isApproved && (
                  <button
                    onClick={() => {
                      setOpenMemberActionId(null);
                      if (confirm(`${m.name} 조합원의 가입을 승인하시겠습니까?`)) {
                        onApproveMember?.(m.id);
                      }
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-black text-sky-600 hover:bg-sky-50 whitespace-nowrap"
                  >
                    ✓ 가입승인
                  </button>
                )}
                <button
                  onClick={() => {
                    setOpenMemberActionId(null);
                    if (confirm(`${m.name} 조합원을 강제 탈퇴시키겠습니까?`)) {
                      onRemoveMember?.(m.id);
                    }
                  }}
                  className="w-full text-left px-4 py-3 text-xs font-black text-red-500 hover:bg-red-50 whitespace-nowrap"
                >
                  ⛔ 강제탈퇴
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    ))
  )}
</div>
<div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5 whitespace-nowrap">성함</th>
                    <th className="px-8 py-5">연락처</th>
                    <th className="px-8 py-5">이메일</th>
                    <th className="px-8 py-5 whitespace-nowrap">차고지</th>
                    <th className="px-8 py-5">가입일</th>
                    <th className="px-8 py-5 whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.length === 0 ? (
                    <tr><td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-bold italic">아직 가입 신청자가 없습니다.</td></tr>
                  ) : members.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-gray-900">
                        <div className="flex items-center flex-nowrap whitespace-nowrap">
                          {m.name}
                          {m.isApproved && (
                            <span className="ml-2 bg-sky-100 text-sky-600 text-[8px] px-1.5 py-0.5 rounded-full font-black whitespace-nowrap">승인됨</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-gray-600 whitespace-nowrap"><span className="inline-block whitespace-nowrap break-keep">{String(m.phone ?? "").replace(/\s+/g, "")}</span></td>
                      <td className="px-8 py-5 text-gray-600 font-medium">{m.email}</td>
                      <td className="px-8 py-5 text-gray-600 font-bold whitespace-nowrap">{m.garage}</td>
                      <td className="px-8 py-5 text-gray-400 text-xs font-medium">{formatDate(m.signupDate)}</td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 sm:space-x-2">
                          {!m.isApproved && (
                            <button 
                              onClick={() => {
                                if (confirm(`${m.name} 조합원의 가입을 승인하시겠습니까?`)) {
                                  onApproveMember?.(m.id);
                                }
                              }}
                              className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[10px] font-black hover:bg-sky-primary hover:text-white transition-all border border-sky-100 shadow-sm active:scale-95 flex items-center whitespace-nowrap"
                            >
                              <i className="fas fa-check mr-1.5"></i> 가입승인
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              if (confirm(`${m.name} 조합원을 강제 탈퇴시키겠습니까?`)) {
                                onRemoveMember?.(m.id);
                              }
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all border border-red-100 shadow-sm active:scale-95 flex items-center whitespace-nowrap"
                          >
                            <i className="fas fa-user-minus mr-1.5"></i> 강제탈퇴
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {adminTab === 'intro' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
              <h3 className="font-black text-gray-900 text-lg flex items-center whitespace-nowrap"><i className="fas fa-comment-dots mr-3 text-sky-primary"></i> 인사말 편집</h3>
              <div className="space-y-4">
                <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border relative group">
                  <img src={settings.greetingImageUrl} className="w-full h-full object-cover" />
                  <button onClick={() => greetingImageRef.current?.click()} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold">사진 교체하기</button>
                  <input type="file" ref={greetingImageRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'greetingImageUrl')} />
                </div>
                <input type="text" name="greetingTitle" value={settings.greetingTitle} onChange={handleSettingsChange} className="w-full border-2 border-gray-100 rounded-xl p-4 text-sm font-bold focus:border-sky-primary outline-none" placeholder="인사말 제목" />
                <textarea name="greetingMessage" value={settings.greetingMessage} onChange={handleSettingsChange} className="w-full border-2 border-gray-100 rounded-xl p-4 text-sm h-40 focus:border-sky-primary outline-none resize-none" placeholder="인사말 본문" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
              <h3 className="font-black text-gray-900 text-lg flex items-center whitespace-nowrap"><i className="fas fa-history mr-3 text-sky-primary"></i> 연혁 데이터 관리</h3>
              <div className="bg-sky-50/50 p-6 rounded-2xl border border-sky-100 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="연(2025)" value={newYear} onChange={e => setNewYear(e.target.value)} className="border rounded-lg p-3 text-sm outline-none focus:border-sky-primary" />
                  <input type="text" placeholder="월(01)" value={newMonth} onChange={e => setNewMonth(e.target.value)} className="border rounded-lg p-3 text-sm outline-none focus:border-sky-primary" />
                  <input type="text" placeholder="일(01)" value={newDay} onChange={e => setNewDay(e.target.value)} className="border rounded-lg p-3 text-sm outline-none focus:border-sky-primary" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 sm:space-x-2">
                  <input type="text" placeholder="연혁 내용을 입력하세요" value={newText} onChange={e => setNewText(e.target.value)} className="flex-1 border rounded-lg p-3 text-sm outline-none focus:border-sky-primary" />
                  <button onClick={handleAddHistory} className="px-6 py-3 bg-sky-primary text-white rounded-lg font-black text-sm whitespace-nowrap shadow-md">추가</button>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {settings.history.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl group border border-transparent hover:border-sky-100 transition-all">
                    <div className="flex items-center space-x-4">
                      <span className="font-black text-sky-700 text-sm w-32">{item.year}</span>
                      <span className="text-sm text-gray-700 font-medium">{item.text}</span>
                    </div>
                    <button onClick={() => handleDeleteHistory(idx)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'offices' && (
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm animate-fadeIn">
            <h3 className="font-black text-gray-900 text-lg mb-8 flex items-center whitespace-nowrap"><i className="fas fa-map-marked-alt mr-3 text-sky-primary"></i> 찾아오시는 길 관리</h3>
            <div className="flex space-x-2 mb-8 border-b pb-4 overflow-x-auto scrollbar-hide no-scrollbar">
              {settings.offices.map(off => (
                <button key={off.id} onClick={() => setActiveOfficeId(off.id)} className={`px-6 py-2 rounded-full text-xs font-black transition-all whitespace-nowrap ${activeOfficeId === off.id ? 'bg-sky-primary text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{off.name}</button>
              ))}
            </div>
            {settings.offices.find(o => o.id === activeOfficeId) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest uppercase">사업소 이름</label>
                    <input type="text" value={settings.offices.find(o => o.id === activeOfficeId)?.name} onChange={(e) => { const updated = settings.offices.map(o => o.id === activeOfficeId ? { ...o, name: e.target.value } : o); setSettings({ ...settings, offices: updated }); }} className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold text-sm outline-none focus:border-sky-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest uppercase">주소</label>
                    <input type="text" value={settings.offices.find(o => o.id === activeOfficeId)?.address} onChange={(e) => { const updated = settings.offices.map(o => o.id === activeOfficeId ? { ...o, address: e.target.value } : o); setSettings({ ...settings, offices: updated }); }} className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold text-sm outline-none focus:border-sky-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest uppercase">전화번호</label>
                    <input type="text" value={settings.offices.find(o => o.id === activeOfficeId)?.phone} onChange={(e) => { const updated = settings.offices.map(o => o.id === activeOfficeId ? { ...o, phone: e.target.value } : o); setSettings({ ...settings, offices: updated }); }} className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold text-sm outline-none focus:border-sky-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest uppercase">지도/전경 이미지</label>
                  <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border relative group shadow-inner">
                    <img src={settings.offices.find(o => o.id === activeOfficeId)?.mapImageUrl} className="w-full h-full object-cover" />
                    <button onClick={() => officeMapInputRef.current?.click()} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold">이미지 변경</button>
                    <input type="file" ref={officeMapInputRef} className="hidden" accept="image/*" onChange={(e) => handleOfficeMapUpload(e, activeOfficeId!)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {adminTab === 'posts' && (
          <div className="space-y-8 animate-fadeIn">
            {/* 게시글 관리 및 휴지통 테이블 (기존과 동일) */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
              <div className="p-8 border-b bg-gray-50/30 flex justify-between items-center">
                <h3 className="font-black text-gray-900">게시글 관리</h3>
                <span className="text-xs text-gray-400 font-bold">총 {posts.length}개</span>
              </div>
              
{/* 모바일 카드형 리스트 (게시글 관리) */}
<div className="sm:hidden p-6 space-y-3">
  {posts.length === 0 ? (
    <div className="py-16 text-center text-gray-400 font-bold italic">게시글이 없습니다.</div>
  ) : (
    posts.map(p => (
      <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] bg-sky-50 text-sky-600 px-2 py-1 rounded font-black whitespace-nowrap">{p.type}</span>
              <div className="font-black text-gray-900 truncate max-w-[220px]">{p.title}</div>
            </div>
            <div className="mt-2 text-xs text-gray-600 flex gap-2">
              <span className="text-gray-400 font-bold shrink-0">작성자</span>
              <span className="font-bold whitespace-nowrap break-keep">{p.author}</span>
            </div>
          </div>

          {/* 액션 정리: 더보기(⋯) 메뉴 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setOpenPostActionId(openPostActionId === p.id ? null : p.id)}
              className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 flex items-center justify-center font-black active:scale-95"
              aria-label="게시글 관리 메뉴"
            >
              ⋯
            </button>

            {openPostActionId === p.id && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-20">
                <div className="flex">
                  <button
                    onClick={() => {
                      setOpenPostActionId(null);
                      onViewPost(p.id, p.type);
                    }}
                    className="flex-1 px-4 py-3 text-xs font-black text-sky-600 hover:bg-sky-50 whitespace-nowrap text-center"
                  >
                    보기
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={() => {
                      setOpenPostActionId(null);
                      onEditPost(p);
                    }}
                    className="flex-1 px-4 py-3 text-xs font-black text-gray-700 hover:bg-gray-50 whitespace-nowrap text-center"
                  >
                    수정
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ))
  )}
</div>
<div className="max-h-96 overflow-y-auto custom-scrollbar hidden sm:block">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                    <tr><th className="px-8 py-4">구분</th><th className="px-8 py-4">제목</th><th className="px-8 py-4">작성자</th><th className="px-8 py-4">관리</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {posts.length === 0 ? (
                      <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-bold italic">게시글이 없습니다.</td></tr>
                    ) : posts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-8 py-4"><span className="text-[10px] bg-sky-50 text-sky-600 px-2 py-1 rounded font-black">{p.type}</span></td>
                        <td className="px-8 py-4 font-bold text-gray-700 truncate max-w-xs">{p.title}</td>
                        <td className="px-8 py-4 text-gray-400 whitespace-nowrap break-keep">{p.author}</td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:gap-0 sm:space-x-4">
                            <button onClick={() => onViewPost(p.id, p.type)} className="text-sky-500 hover:underline font-bold text-xs whitespace-nowrap">보기</button>
                            <button onClick={() => onEditPost(p)} className="text-gray-500 hover:text-gray-900 font-bold text-xs whitespace-nowrap">수정</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-red-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b bg-red-50/30 flex justify-between items-center">
                <h3 className="font-black text-red-900 flex items-center whitespace-nowrap"><i className="fas fa-trash-alt mr-3"></i> 휴지통</h3>
                <span className="text-xs text-red-400 font-bold">{deletedPosts.length}개의 삭제된 글</span>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-gray-50">
                    {deletedPosts.length === 0 ? (
                      <tr><td className="px-8 py-10 text-center text-gray-300 font-bold italic">휴지통이 비어 있습니다.</td></tr>
                    ) : deletedPosts.map(p => (
                      <tr key={p.id} className="hover:bg-red-50/20">
                        <td className="px-8 py-4 font-bold text-gray-500 truncate max-sm">{p.title}</td>
                        <td className="px-8 py-4 text-right space-x-4">
                          <div className="flex items-center gap-6 whitespace-nowrap">
                      <button onClick={() => onRestorePost(p.id)} className="text-sky-500 font-black text-xs hover:underline whitespace-nowrap">복구</button> <button onClick={() => onPermanentDelete(p.id)} className="text-red-400 font-black text-xs hover:underline whitespace-nowrap">영구삭제</button>
                    </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        
        {adminTab === 'storage' && (
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden animate-fadeIn">
            <div className="p-8 border-b bg-gray-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-gray-900">첨부파일 사용량</h3>
                <p className="text-xs text-gray-400 mt-1 font-bold">
                  게시글에 첨부된 파일(dataURL/base64)의 총 용량을 계산합니다. (관리자용)
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDownloadAttachmentReportCSV}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-50 hover:bg-emerald-700 transition-all text-xs whitespace-nowrap"
                >
                  CSV 내려받기
                </button>
                <button
                  onClick={handleDownloadAttachmentReportJSON}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-black transition-all text-xs whitespace-nowrap"
                >
                  JSON 내려받기
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-xs text-gray-400 font-black">총 첨부파일</div>
                  <div className="mt-2 text-2xl font-black text-gray-900">{attachmentStats.totalFiles}개</div>
                  <div className="mt-1 text-xs text-gray-500 font-bold">전체 게시글 기준</div>
                </div>
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-xs text-gray-400 font-black">총 용량</div>
                  <div className="mt-2 text-2xl font-black text-gray-900">{formatFileSize(attachmentStats.totalBytes)}</div>
                  <div className="mt-1 text-xs text-gray-500 font-bold">{attachmentStats.totalBytes.toLocaleString()} bytes</div>
                </div>
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-xs text-gray-400 font-black">사진</div>
                  <div className="mt-2 text-2xl font-black text-gray-900">{attachmentStats.imageFiles}개</div>
                  <div className="mt-1 text-xs text-gray-500 font-bold">{formatFileSize(attachmentStats.imageBytes)}</div>
                </div>
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-xs text-gray-400 font-black">문서/기타</div>
                  <div className="mt-2 text-2xl font-black text-gray-900">{attachmentStats.docFiles}개</div>
                  <div className="mt-1 text-xs text-gray-500 font-bold">{formatFileSize(attachmentStats.docBytes)}</div>
                </div>
              </div>

              {/* By board */}
              <div className="rounded-[2rem] border bg-gray-50/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-black text-gray-900">게시판별 사용량</div>
                    <div className="text-xs text-gray-400 font-bold mt-1">용량 기준 내림차순</div>
                  </div>
                  <div className="text-xs text-gray-500 font-black">
                    총 {formatFileSize(attachmentStats.totalBytes)}
                  </div>
                </div>

                {attachmentStats.boardRows.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-bold italic">첨부파일이 없습니다.</div>
                ) : (
                  <div className="space-y-3">
                    {attachmentStats.boardRows.map((b) => {
                      const total = attachmentStats.totalBytes || 1;
                      const pct = Math.min(100, Math.round((b.bytes / total) * 100));
                      return (
                        <div key={b.type} className="bg-white rounded-2xl border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-black text-gray-900">{boardLabel(b.type)}</div>
                            <div className="text-xs text-gray-500 font-black whitespace-nowrap">
                              {b.files}개 · {formatFileSize(b.bytes)} ({pct}%)
                            </div>
                          </div>
                          <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top files */}
              <div className="rounded-[2rem] border bg-white overflow-hidden">
                <div className="p-6 border-b bg-gray-50/30">
                  <div className="text-lg font-black text-gray-900">용량 상위 10개 파일</div>
                  <div className="text-xs text-gray-400 font-bold mt-1">클릭하면 해당 파일을 바로 다운로드할 수 있습니다.</div>
                </div>

                <div className="p-6">
                  {attachmentStats.topFiles.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 font-bold italic">표시할 파일이 없습니다.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 font-black border-b">
                            <th className="text-left py-3 pr-3">파일</th>
                            <th className="text-left py-3 pr-3">게시판</th>
                            <th className="text-left py-3 pr-3">게시글</th>
                            <th className="text-right py-3 pr-3">용량</th>
                            <th className="text-right py-3">다운로드</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attachmentStats.topFiles.map((f, idx) => (
                            <tr key={`${f.postId}-${idx}`} className="border-b last:border-b-0">
                              <td className="py-3 pr-3">
                                <div className="font-black text-gray-900">{f.fileName}</div>
                                <div className="text-[11px] text-gray-400 font-bold">{f.mime || 'unknown'}</div>
                              </td>
                              <td className="py-3 pr-3 font-black text-gray-700 whitespace-nowrap">{boardLabel(f.postType)}</td>
                              <td className="py-3 pr-3">
                                <div className="font-bold text-gray-700 line-clamp-1">{f.postTitle}</div>
                                <div className="text-[11px] text-gray-400 font-bold mt-0.5">{formatDate(f.postCreatedAt)}</div>
                              </td>
                              <td className="py-3 pr-3 text-right font-black text-gray-900 whitespace-nowrap">{formatFileSize(f.bytes)}</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => downloadDataUrl(f.dataUrl, f.fileName)}
                                  className="px-3 py-2 bg-sky-primary text-white rounded-xl font-black text-xs hover:opacity-90 transition-all whitespace-nowrap"
                                >
                                  다운로드
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 font-bold leading-relaxed">
                <div className="font-black text-gray-700 mb-1">참고</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>첨부파일은 현재 게시글 데이터에 <span className="font-black">base64(dataURL)</span>로 포함되어 저장됩니다. 파일이 많아지면 데이터 용량이 빠르게 증가합니다.</li>
                  <li>장기 운영 시에는 Supabase Storage 같은 파일 스토리지로 옮기고, 게시글에는 파일 URL만 저장하는 방식이 권장됩니다.</li>
                </ul>
              </div>
            </div>
          </div>
        )}


        {adminTab === 'push' && (
          <div className="bg-white rounded-[2.5rem] border shadow p-8">
            <h3 className="text-2xl font-extrabold mb-3">푸시 알림 (PWA)</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              테스트 단계에서는 조합원이 <b>홈화면에 추가(PWA)</b> 후 <b>알림 허용</b>을 하면,
              앱이 열려있는 동안 새 게시글 등록 시 알림이 표시됩니다.
              <br />
              <span className="text-sm text-gray-500">
                ※ 앱이 꺼져있을 때도 알림(진짜 웹 푸시)을 보내려면 VAPID 키 + 발송 함수(서버/Edge Function)가 필요합니다.
              </span>
            </p>

            <div className="flex flex-col gap-3">
              <button
                className="px-5 py-3 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                onClick={async () => {
                  try {
                    // ✅ 반드시 '사용자 클릭' 이벤트 안에서 호출되어야 권한 팝업이 뜹니다.
                    if (!('Notification' in window)) {
                      alert('이 브라우저는 알림을 지원하지 않습니다.');
                      return;
                    }

                    // ✅ 서비스워커가 없으면 먼저 등록/대기
                    if ('serviceWorker' in navigator) {
                      try {
                        await navigator.serviceWorker.register('/service-worker.js');
                        await navigator.serviceWorker.ready;
                      } catch (e) {
                        console.error('서비스워커 등록 실패', e);
                      }
                    }

                    const perm = await Notification.requestPermission();
                    alert(`알림 권한: ${perm}`);
                  } catch (e) {
                    console.error(e);
                    alert('알림 권한 요청 중 오류가 발생했습니다.');
                  }
                }}
              >
                알림 켜기 (권한 요청)
              </button>

              <button
                className="px-5 py-3 rounded-full bg-white border font-bold hover:bg-gray-50 transition"
                onClick={async () => {
                  try {
                    if (!('Notification' in window)) {
                      alert('이 브라우저는 알림을 지원하지 않습니다.');
                      return;
                    }

                    // 권한이 granted가 아니면 먼저 요청
                    let perm: NotificationPermission = Notification.permission;
                    if (perm !== 'granted') perm = await Notification.requestPermission();
                    if (perm !== 'granted') {
                      alert('알림 권한이 허용되지 않았습니다.');
                      return;
                    }

                    // 실제 웹푸시 구독 + 저장 (VAPID 키 필요)
                    const { ensurePushSubscribed } = await import('../services/pushService');
                    const result: any = await ensurePushSubscribed();
      if (result?.anonymous) {
        alert('웹푸시 구독 저장 완료! (비로그인: user_id 없이 저장됨)');
      } else {
        alert('웹푸시 구독 및 저장 완료!');
      }
                  } catch (e) {
                    console.error(e);
                    alert(`푸시 구독 실패: ${e?.message || String(e)}`);
                  }
                }}
              >
                웹 푸시 구독 저장 (선택)
              </button>

              <button
                className="px-5 py-3 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition"
                onClick={async () => {
                  try {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification('우리노동조합', {
                      body: '푸시 알림 테스트입니다.',
                      icon: '/pwa/icon-192.png',
                      badge: '/pwa/icon-192.png',
                      data: { url: '/' }
                    });
                  } catch {
                    alert('테스트 알림을 표시할 수 없습니다. (서비스워커/권한 확인)');
                  }
                }}
              >
                테스트 알림 보내기 (내 폰에서)
              </button>
            </div>
          </div>
        )}

        {adminTab === 'settings' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-12">
              <div>
                <h3 className="font-black text-gray-900 text-lg mb-8 flex items-center whitespace-nowrap"><i className="fas fa-palette mr-3 text-sky-primary"></i> 메인 슬라이드 관리 (최대 5장)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-12">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase">슬라이드 {idx + 1}</label>
                        {idx > 0 && (settings.heroImageUrls || [])[idx] && (
                          <button onClick={() => clearHeroImage(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                            <i className="fas fa-times-circle text-xs"></i>
                          </button>
                        )}
                      </div>
                      <div className="aspect-[4/3] bg-gray-50 rounded-[1.5rem] overflow-hidden border-2 border-white shadow-md relative group">
                        <img 
                          src={(settings.heroImageUrls || [])[idx] || (idx === 0 ? settings.heroImageUrl : '') || 'https://via.placeholder.com/400x300?text=Empty'} 
                          className="w-full h-full object-cover" 
                        />
                        <button onClick={() => heroImageRefs[idx].current?.click()} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center font-black">
                          <i className="fas fa-camera text-xl mb-1"></i>
                          { (settings.heroImageUrls || [])[idx] ? '변경' : '추가' }
                        </button>
                        <input type="file" ref={heroImageRefs[idx]} className="hidden" accept="image/*" onChange={(e) => handleHeroImageUpload(e, idx)} />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-gray-50">
                  <div className="space-y-6 flex flex-col justify-center">
                    <div><label className="block text-[10px] font-black text-gray-400 mb-2 tracking-widest uppercase">사이트 이름</label><input type="text" name="siteName" value={settings.siteName} onChange={handleSettingsChange} className="w-full border-2 border-gray-100 rounded-2xl p-4 font-black text-xl text-sky-primary outline-none focus:border-sky-primary shadow-sm" /></div>
                    <div><label className="block text-[10px] font-black text-gray-400 mb-2 tracking-widest uppercase">메인 슬로건</label><input type="text" name="heroTitle" value={settings.heroTitle} onChange={handleSettingsChange} className="w-full border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-700 outline-none focus:border-sky-primary" /></div>
                    <div><label className="block text-[10px] font-black text-gray-400 mb-2 tracking-widest uppercase">보조 슬로건</label><input type="text" name="heroSubtitle" value={settings.heroSubtitle} onChange={handleSettingsChange} className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm text-gray-500 outline-none focus:border-sky-primary" /></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black mb-2 flex items-center whitespace-nowrap"><i className="fas fa-sync-alt mr-3 text-sky-400"></i> 데이터 백업 및 관리</h3>
                  <p className="text-sm text-gray-400 font-bold leading-relaxed">다른 기기로 데이터를 옮기기 위해 백업 파일을 활용하세요.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={handleExportData} className="group flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all active:scale-95">
                  <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform"><i className="fas fa-file-export text-xl"></i></div>
                  <span className="font-black text-sm mb-1">데이터 내보내기</span>
                </button>
                <button onClick={() => importFileInputRef.current?.click()} className="group flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all active:scale-95">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform"><i className="fas fa-file-import text-xl"></i></div>
                  <span className="font-black text-sm mb-1">데이터 가져오기</span>
                  <input type="file" ref={importFileInputRef} className="hidden" accept="application/json" onChange={handleImportData} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{` .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; } `}</style>
    </div>
  );
};

export default AdminPanel;
