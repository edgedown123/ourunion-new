
import React, { useEffect, useMemo, useState } from 'react';
import { Post, BoardType, UserRole, Comment } from '../types';
import { NAV_ITEMS } from '../constants';

interface BoardProps {
  type: BoardType;
  posts: Post[];
  onWriteClick: (specificType?: BoardType) => void;
  onEditClick: (post: Post) => void;
  selectedPostId: string | null;
  onSelectPost: (id: string | null) => void;
  userRole: UserRole;
  onDeletePost?: (id: string) => void;
  onTogglePin?: (post: Post, pinned: boolean) => void;
  onSaveComment?: (postId: string, content: string, parentId?: string) => void;
  onEditComment?: (postId: string, commentId: string, content: string, parentId?: string) => void;
  onDeleteComment?: (postId: string, commentId: string, parentId?: string) => void;
  currentUserName?: string;
  currentUserId?: string;
}

const POSTS_PER_PAGE = 7;

const getPageNumbers = (page: number, totalPages: number): number[] => {
  if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 2) return [1, 2, 3];
  if (page >= totalPages - 1) return [totalPages - 2, totalPages - 1, totalPages];
  return [page - 1, page, page + 1];
};

const Board: React.FC<BoardProps> = ({ 
  type, posts, onWriteClick, onEditClick, selectedPostId, 
  onSelectPost, userRole, onDeletePost, onTogglePin, onSaveComment, onEditComment, onDeleteComment, currentUserName, currentUserId 
}) => {
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // 페이징
  const [page, setPage] = useState(1);
  const [noticeAllPage, setNoticeAllPage] = useState(1);
  const [familyEventPage, setFamilyEventPage] = useState(1);

  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ commentId: string; parentId?: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // 게시판 전환 시 페이징 초기화
  useEffect(() => {
    setPage(1);
    setNoticeAllPage(1);
    setFamilyEventPage(1);
  }, [type]);
  
  const canManageComment = (author: string) => userRole === 'admin' || (userRole !== 'guest' && author === (currentUserName || ''));

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId && p.type === type) : null;

  // 날짜 포맷팅 유틸리티 함수 (YYYY.MM.DD HH:mm)
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  };

  const Pagination = ({
    current,
    total,
    onChange,
  }: {
    current: number;
    total: number;
    onChange: (p: number) => void;
  }) => {
    const pageNumbers = useMemo(() => getPageNumbers(current, total), [current, total]);
    if (total <= 1) return null;

    const baseBtn =
      'page-btn inline-flex items-center justify-center font-black rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed';
    // 모바일: 크게, 데스크톱: 조금 작게
    const sizeClass = 'min-w-[48px] h-12 px-4 text-base md:min-w-[40px] md:h-10 md:px-3 md:text-sm';

    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <button
          className={`${baseBtn} ${sizeClass}`}
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          aria-label="이전 페이지"
        >
          이전
        </button>

        {pageNumbers.map((n) => (
          <button
            key={n}
            className={`${baseBtn} ${sizeClass} ${n === current ? 'border-sky-primary text-sky-primary' : ''}`}
            onClick={() => onChange(n)}
            aria-label={`${n} 페이지`}
          >
            {n}
          </button>
        ))}

        <button
          className={`${baseBtn} ${sizeClass}`}
          onClick={() => onChange(Math.min(total, current + 1))}
          disabled={current === total}
          aria-label="다음 페이지"
        >
          다음
        </button>
      </div>
    );
  };
  
  // 현재 보드 정보 찾기
  let boardInfo = NAV_ITEMS.find(item => item.id === type);
  if (!boardInfo) {
    for (const item of NAV_ITEMS) {
      const child = item.children?.find(c => c.id === type);
      if (child) {
        boardInfo = { id: child.id, label: child.label, icon: item.icon };
        break;
      }
    }
  }

  const canManagePost = (post: Post) => {
    if (userRole === 'admin') return true;
    if (userRole === 'guest') return false;
    // authorId 우선, 없으면 author 이름으로 레거시 호환
    if (post.authorId && currentUserId) return post.authorId === currentUserId;
    return post.author === (currentUserName || '');
  };

  const handleEditPost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPost) return;
    if (!canManagePost(selectedPost)) {
      alert('작성자만 수정할 수 있습니다.');
      return;
    }
    setPostMenuOpen(false);
    onEditClick(selectedPost);
  };
  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPost || !onTogglePin) return;
    if (userRole !== 'admin') return;
    onTogglePin(selectedPost, !(selectedPost.pinned));
    setPostMenuOpen(false);
  };


  const handleDeletePost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPost || !onDeletePost) return;
    if (!canManagePost(selectedPost)) {
      alert('작성자만 삭제할 수 있습니다.');
      return;
    }
    setPostMenuOpen(false);
    onDeletePost(selectedPost.id);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !onSaveComment || !selectedPost) return;
    onSaveComment(selectedPost.id, newComment);
    setNewComment('');
  };

  const handleReplySubmit = (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() || !onSaveComment || !selectedPost) return;
    onSaveComment(selectedPost.id, replyContent, parentId);
    setReplyContent('');
    setReplyingToId(null);
  };

  const filteredPosts = useMemo(
    () => posts.filter(p => p.type === type).sort((a, b) => {
        const ap = !!a.pinned;
        const bp = !!b.pinned;
        if (ap !== bp) return ap ? -1 : 1;
        const at = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const bt = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        if (at !== bt) return bt - at;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [posts, type]
  );

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));

  // 게시글이 줄어들어 현재 페이지가 범위를 벗어나면 보정
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // 공지(듀얼) 보드 페이지 보정
  useEffect(() => {
    const nTotal = Math.max(1, Math.ceil(posts.filter(p => p.type === 'notice_all').length / POSTS_PER_PAGE));
    const fTotal = Math.max(1, Math.ceil(posts.filter(p => p.type === 'family_events').length / POSTS_PER_PAGE));
    if (noticeAllPage > nTotal) setNoticeAllPage(nTotal);
    if (familyEventPage > fTotal) setFamilyEventPage(fTotal);
  }, [posts, noticeAllPage, familyEventPage]);

  const pagedPosts = useMemo(
    () => filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
    [filteredPosts, page]
  );

  // 모바일에서 일부 게시판 목록을 더 촘촘하게(행 높이/여백 축소)
  // - 자유게시판/자료실
  // - 공지사항 하위 탭(공고/공지, 경조사)
  const isCompactList =
    type === 'free' ||
    type === 'resources' ||
    type === 'notice_all' ||
    type === 'family_events';

  // 상세 보기 모드
  if (selectedPost) {
    const imageAttachments = selectedPost.attachments?.filter(a => a.type.startsWith('image/')) || [];

    /**
     * 게시물/댓글 본문에 입력된 URL을 자동으로 링크로 변환합니다.
     * - http/https, www. 형태 지원
     * - 문장 끝의 ". , ) ] }" 등 흔한 구두점은 링크에서 제외
     */
    const linkifyText = (text: string): React.ReactNode[] => {
      if (!text) return [];

      // URL 후보를 찾고, 앞/뒤 문자를 최대한 보존합니다.
      const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = urlRegex.exec(text)) !== null) {
        const start = match.index;
        const rawUrl = match[0];

        if (start > lastIndex) {
          nodes.push(text.slice(lastIndex, start));
        }

        // 흔한 문장부호는 링크에서 제외(원문은 유지)
        const trailingPunct = /[).,!?\]}>"']+$/;
        const m2 = rawUrl.match(trailingPunct);
        const cut = m2 ? m2[0] : '';
        const cleanUrl = cut ? rawUrl.slice(0, -cut.length) : rawUrl;
        const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;

        nodes.push(
          <a
            key={`url-${start}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 underline break-all hover:text-sky-700"
          >
            {cleanUrl}
          </a>
        );
        if (cut) nodes.push(cut);

        lastIndex = start + rawUrl.length;
      }

      if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
      return nodes;
    };


const renderContentWithInlineImages = (raw?: unknown) => {
  // Supabase/레거시 데이터에서 content가 null/undefined로 들어올 수 있어 안전 처리
  const safeRaw =
    typeof raw === 'string'
      ? raw
      : raw == null
        ? ''
        : String(raw);

  try {
    const parts = safeRaw.split(/\[\[img:(\d+)\]\]/g);
    const used = new Set<number>();
    const nodes: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i]) {
          nodes.push(
            <span key={`t-${i}`} className="whitespace-pre-wrap break-words">
              {linkifyText(parts[i])}
            </span>
          );
        }
      } else {
        const idx = Number(parts[i]);
        if (!Number.isNaN(idx) && imageAttachments?.[idx]) {
          used.add(idx);
          nodes.push(
            <div
              key={`img-${i}`}
              // 이미지가 너무 "꽉" 차 보이지 않도록 좌우 여백을 조금 남기기
              // (기존: 카드 패딩을 "뚫고" 풀-블리드에 가깝게 표시)
              className="my-4 w-[calc(100%+2rem)] -mx-4 overflow-hidden rounded-2xl border border-gray-100 bg-white md:w-[calc(100%+3rem)] md:-mx-6"
            >
              <img
                src={imageAttachments[idx].data}
                alt={`본문 이미지 ${idx + 1}`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          );
        }
      }
    }

    // 본문이 완전히 비어있는 경우에도 최소한의 노드를 반환(렌더 크래시 방지)
    if (nodes.length === 0) {
      nodes.push(
        <span key="empty" className="whitespace-pre-wrap break-words text-gray-500">
          (내용 없음)
        </span>
      );
    }

    return { nodes, used };
  } catch (e) {
    console.error('[Board] renderContentWithInlineImages failed:', e);
    return {
      nodes: [
        <span key="err" className="whitespace-pre-wrap break-words text-gray-500">
          (내용을 표시할 수 없습니다)
        </span>,
      ],
      used: new Set<number>(),
    };
  }
};    const isNoticeCategory = selectedPost.type === 'notice_all' || selectedPost.type === 'family_events';

    return (
      <div className="max-w-4xl mx-auto py-8 px-2 sm:px-5 animate-fadeIn">
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => onSelectPost(null)} className="flex items-center text-gray-500 hover:text-sky-primary group font-bold">
            <i className="fas fa-arrow-left mr-2 group-hover:-translate-x-1 transition-transform"></i> 목록으로
          </button>
          
          {canManagePost(selectedPost) && (
            <div className="relative">
              <button
                onClick={() => setPostMenuOpen(v => !v)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="게시물 메뉴"
              >
                <i className="fas fa-ellipsis-v text-gray-500"></i>
              </button>

              {postMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 bg-white rounded-2xl border shadow-xl overflow-hidden z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                {userRole === 'admin' && (
                  <button
                    onClick={handleTogglePin}
                    className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-yellow-50 text-yellow-800"
                  >
                    <i className="fas fa-thumbtack mr-2"></i> {selectedPost?.pinned ? '상단고정 해제' : '상단고정'}
                  </button>
                )}
                  <button
                    onClick={handleEditPost}
                    className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-gray-50"
                  >
                    <i className="fas fa-edit mr-2 text-sky-primary"></i> 글 수정
                  </button>
                  <button
                    onClick={handleDeletePost}
                    className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-red-50 text-red-600"
                  >
                    <i className="fas fa-trash-alt mr-2"></i> 삭제하기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <article className="bg-white rounded-[2.5rem] border p-10 md:p-14 shadow-sm relative overflow-hidden mb-10">

          <header className="mb-12">
            {isNoticeCategory && (
              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black border mb-4 ${selectedPost.type === 'notice_all' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                {selectedPost.type === 'notice_all' ? '공고/공지' : '경조사'}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-black mb-8 text-gray-900 leading-tight">{selectedPost.title}</h1>
            <div className="flex flex-wrap items-center text-xs md:text-sm font-bold text-gray-400 border-b border-gray-50 pb-8 gap-y-2">
              <span className="flex items-center mr-8"><i className="fas fa-user-circle mr-2.5 text-sky-primary/50"></i>{selectedPost.author}</span>
              <span className="flex items-center mr-8"><i className="fas fa-calendar-alt mr-2.5"></i>{formatDate(selectedPost.createdAt)}</span>
              <span className="flex items-center mr-8"><i className="fas fa-eye mr-2.5"></i>조회 {selectedPost.views}</span>
            </div>
          </header>

          <div className="prose prose-sky max-w-none text-gray-700 leading-relaxed min-h-[120px] md:min-h-[200px] text-base md:text-lg prose-p:my-3">
            {renderContentWithInlineImages(selectedPost.content).nodes}
          </div>

          {(() => {
            const { used } = renderContentWithInlineImages(selectedPost.content);
            const remaining = imageAttachments.filter((_, idx) => !used.has(idx));
            if (remaining.length === 0) return null;
            return (
              <div className="mt-14 space-y-8">
                {remaining.map((img, idx) => (
                  <div key={idx} className="rounded-3xl overflow-hidden shadow-xl border border-gray-100">
                    <img src={img.data} alt={`첨부 이미지 ${idx + 1}`} className="w-full h-auto object-contain bg-gray-50" />
                  </div>
                ))}
              </div>
            );
          })()}

          {selectedPost.attachments && selectedPost.attachments.length > 0 && (
            // 모바일에서 점선 박스(첨부파일 영역) 내부 패딩을 줄여 카드/파일명이 더 넓게 보이도록
            <div className="mt-20 p-4 md:p-10 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
              <p className="text-xs font-black text-gray-400 mb-6 uppercase tracking-widest flex items-center">
                <i className="fas fa-paperclip mr-2.5 text-sky-primary text-base"></i> 첨부파일 ({selectedPost.attachments.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPost.attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-2xl border flex flex-col gap-3 shadow-sm hover:border-sky-primary transition-all group sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* 파일명 (모바일: 2줄까지 최대한 보여주기 / 데스크톱: 한 줄 말줄임) */}
                    <div className="flex items-start sm:items-center sm:min-w-0">
                      <span className="text-sm font-bold text-gray-700 whitespace-normal break-words leading-snug sm:truncate">
                        {file.name}
                      </span>
                    </div>

                    {/* 다운로드 버튼 (모바일: 아래로 분리 / 텍스트 줄바꿈 방지) */}
                    <a
                      href={file.data}
                      download={file.name}
                      className="inline-flex w-fit items-center justify-center px-3 py-1.5 bg-sky-primary text-white text-[11px] font-black rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
                    >
                      다운로드
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* 댓글 섹션 */}
        <section className="bg-white rounded-[2.5rem] border p-4 md:p-7 shadow-sm">
          <h3 className="text-lg md:text-xl font-black text-gray-900 mb-3 md:mb-5 flex items-center">
            <i className="fas fa-comments mr-2 md:mr-3 text-sky-primary"></i> 댓글 
            <span className="ml-3 bg-sky-50 text-sky-primary px-2 py-0.5 md:px-3 md:py-1 rounded-xl text-xs md:text-sm">
              {selectedPost.comments?.reduce((acc, curr) => acc + 1 + (curr.replies?.length || 0), 0) || 0}
            </span>
          </h3>
          
          <div className="space-y-3 md:space-y-4 mb-5 md:mb-7">
            {selectedPost.comments?.map((comment) => (
              <div key={comment.id} className="border-b border-gray-50 last:border-0 pb-5 md:pb-8 animate-fadeIn">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base font-black text-gray-900 flex items-center">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-xs text-gray-400">
                      <i className="fas fa-user"></i>
                    </div>
                    {comment.author}
                  </span>
                  {canManageComment(comment.author) && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCommentMenuOpenId(commentMenuOpenId === comment.id ? null : comment.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-50 text-gray-400"
                          aria-label="댓글 메뉴"
                        >
                          ⋮
                        </button>
                        {commentMenuOpenId === comment.id && (
                          <div className="absolute right-0 mt-2 w-28 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTarget({ commentId: comment.id });
                                setEditDraft(comment.content);
                                setCommentMenuOpenId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCommentMenuOpenId(null);
                                onDeleteComment?.(selectedPost.id, comment.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
                {editingTarget?.commentId === comment.id && !editingTarget.parentId ? (
                  <div className="pl-11 mb-3">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-sky-primary outline-none min-h-[70px] md:min-h-[90px] resize-none bg-gray-50/30"
                    />
                    <div className="flex gap-2 justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!editDraft.trim()) return;
                          onEditComment?.(selectedPost.id, comment.id, editDraft);
                          setEditingTarget(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-black hover:bg-black active:scale-95 transition-all"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTarget(null)}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-black hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base text-gray-600 leading-relaxed pl-11 mb-3 whitespace-pre-wrap break-words">
                    {linkifyText(comment.content)}
                  </p>
                )}
                
                <div className="pl-11 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-300 uppercase">{formatDate(comment.createdAt)}</span>
                  {userRole !== 'guest' && (
                    <button
                      onClick={() => {
                        setReplyingToId(replyingToId === comment.id ? null : comment.id);
                        setReplyContent('');
                      }}
                      className="text-xs font-black text-gray-400 hover:text-gray-500 hover:underline flex items-center"
                    >
                      답글쓰기
                    </button>
                  )}
                </div>

                {replyingToId === comment.id && (
                  <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="mt-3 ml-11 animate-fadeIn">
                    <div className="relative">
                      <textarea 
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="따뜻한 답글을 남겨주세요."
                        className="w-full border-2 border-sky-50 rounded-2xl p-3 text-sm focus:border-sky-primary outline-none min-h-[50px] resize-none pr-24 bg-gray-50/50 md:min-h-[60px]"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        disabled={!replyContent.trim()}
                        className="absolute right-4 bottom-4 bg-sky-primary text-white px-5 py-2.5 rounded-xl text-xs font-black disabled:opacity-30 shadow-lg"
                      >
                        등록
                      </button>
                    </div>
                  </form>
                )}

                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-6 ml-11 space-y-6 border-l-2 border-gray-100 pl-6">
                    {comment.replies.map(reply => (
                      <div key={reply.id} className="animate-fadeIn">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-black text-gray-700 flex items-center">
                            {reply.author}
                          </span>
                          {canManageComment(reply.author) && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setCommentMenuOpenId(commentMenuOpenId === reply.id ? null : reply.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-50 text-gray-400"
                                aria-label="답글 메뉴"
                              >
                                ⋮
                              </button>
                              {commentMenuOpenId === reply.id && (
                                <div className="absolute right-0 mt-2 w-28 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTarget({ commentId: reply.id, parentId: comment.id });
                                      setEditDraft(reply.content);
                                      setCommentMenuOpenId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCommentMenuOpenId(null);
                                      onDeleteComment?.(selectedPost.id, reply.id, comment.id);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {editingTarget?.commentId === reply.id && editingTarget.parentId === comment.id ? (
                        <div className="pl-7">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:border-sky-primary outline-none min-h-[50px] md:min-h-[60px] resize-none bg-gray-50/30"
                          />
                          <div className="flex gap-2 justify-end mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!editDraft.trim()) return;
                                onEditComment?.(selectedPost.id, reply.id, editDraft, comment.id);
                                setEditingTarget(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-black active:scale-95 transition-all"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTarget(null)}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200 active:scale-95 transition-all"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 leading-relaxed pl-7 whitespace-pre-wrap break-words">
                          {linkifyText(reply.content)}
                        </p>
                      )}
                      <div className="pl-7 flex justify-end mt-1">
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{formatDate(reply.createdAt)}</span>
                      </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {userRole !== 'guest' && (
            <form onSubmit={handleCommentSubmit} className="relative pt-3 md:pt-5 border-t">
              <textarea 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)} 
                className="w-full border-2 border-gray-100 rounded-[2rem] p-3 md:p-4 text-sm md:text-base focus:border-sky-primary outline-none min-h-[44px] md:min-h-[70px] resize-none pr-24 md:pr-32 transition-all bg-gray-50/30"
              />
              <button 
                type="submit" 
                disabled={!newComment.trim()} 
                className="absolute right-4 bottom-4 md:right-8 md:bottom-8 bg-gray-900 text-white px-4 py-2 md:px-8 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-black disabled:opacity-30 shadow-lg md:shadow-xl active:scale-95 transition-all"
              >
                댓글 등록
              </button>
            </form>
          )}
        </section>
      </div>
    );
  }

  // 듀얼 보드 렌더링 함수
  const renderDualBoard = () => {
    const noticeAllAll = posts
      .filter(p => p.type === 'notice_all')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const familyEventAll = posts
      .filter(p => p.type === 'family_events')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const noticeAllTotalPages = Math.max(1, Math.ceil(noticeAllAll.length / POSTS_PER_PAGE));
    const familyEventTotalPages = Math.max(1, Math.ceil(familyEventAll.length / POSTS_PER_PAGE));

    const noticeAllPosts = noticeAllAll.slice((noticeAllPage - 1) * POSTS_PER_PAGE, noticeAllPage * POSTS_PER_PAGE);
    const familyEventPosts = familyEventAll.slice((familyEventPage - 1) * POSTS_PER_PAGE, familyEventPage * POSTS_PER_PAGE);

    const PostList = ({
      title,
      icon,
      colorClass,
      data,
      current,
      total,
      onChange,
    }: {
      title: string;
      icon: string;
      colorClass: string;
      data: Post[];
      current: number;
      total: number;
      onChange: (p: number) => void;
    }) => (
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
        <div className={`p-8 border-b border-gray-50 flex justify-between items-center ${colorClass}`}>
          <h3 className="text-xl font-black flex items-center">
            <i className={`fas ${icon} mr-3`}></i>
            {title}
          </h3>
        </div>
        <div className="flex-grow">
          {data.length === 0 ? (
            <div className="py-20 text-center text-gray-300 font-bold italic">최근 게시글이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.map(post => (
                <li key={post.id}>
                  <button
                    onClick={() => onSelectPost(post.id)}
                    className={`w-full text-left p-6 transition-colors group relative ${post.pinned ? 'bg-yellow-50/70 hover:bg-yellow-50 pl-9' : 'hover:bg-gray-50'}`}
                  >
                    {post.pinned && (
                      <span className="absolute left-0 top-0 h-full w-1.5 bg-yellow-400" />
                    )}
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-gray-700 truncate group-hover:text-sky-primary transition-colors flex-1 mr-4 flex items-center gap-2">
                        {post.pinned && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-200/60 text-yellow-900 font-black border border-yellow-300/60">📌 상단고정</span>
                        )}
                        <span className="truncate">{post.title}</span>
                      </p>
                      <span className="text-[11px] text-gray-300 font-black whitespace-nowrap">{formatDate(post.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Pagination current={current} total={total} onChange={onChange} />
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
        <PostList
          title="공고/공지"
          icon="fa-bullhorn"
          colorClass="bg-sky-primary text-white"
          data={noticeAllPosts}
          current={noticeAllPage}
          total={noticeAllTotalPages}
          onChange={setNoticeAllPage}
        />
        <PostList
          title="경조사"
          icon="fa-bullhorn"
          colorClass="bg-sky-primary text-white"
          data={familyEventPosts}
          current={familyEventPage}
          total={familyEventTotalPages}
          onChange={setFamilyEventPage}
        />
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-5 animate-fadeIn">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 flex items-center tracking-tight">
            <i className={`fas ${boardInfo?.icon || 'fa-list'} mr-5 text-sky-primary`}></i>
            {boardInfo?.label}
          </h2>
          <p className="text-gray-400 font-bold text-xs mt-2 ml-1">우리노동조합 소통 공간</p>
        </div>
        {userRole !== 'guest' && (userRole === 'admin' || type === 'free' || type === 'resources') && type !== 'notice' && (
          <button 
            onClick={() => onWriteClick(type)} 
            className="bg-sky-primary text-white px-4 py-2 md:px-8 md:py-4 rounded-xl md:rounded-[1.5rem] font-black text-xs md:text-base shadow-xl shadow-sky-100 hover:opacity-90 active:scale-95 transition-all"
          >
            <i className="fas fa-pen-nib mr-1.5 md:mr-2"></i> 글쓰기
          </button>
        )}
      </div>

      {type === 'notice' ? (
        renderDualBoard()
      ) : (
        <div className="bg-white shadow-xl rounded-[3rem] border border-gray-50 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filteredPosts.length === 0 ? (
              <li className="px-6 py-40 text-center text-gray-300 font-bold italic text-lg">작성된 게시글이 없습니다.</li>
            ) : (
              pagedPosts.map((post) => (
                <li key={post.id}>
                  <button
                    onClick={() => onSelectPost(post.id)}
                    className={`block w-full text-left transition-all group relative ${post.pinned ? 'bg-yellow-50/70 hover:bg-yellow-50' : 'hover:bg-gray-50/40'} ${isCompactList ? 'p-4 md:p-8' : 'p-8 md:p-10'} ${post.pinned ? (isCompactList ? 'pl-7 md:pl-10' : 'pl-10 md:pl-12') : ''}`}
                  >
                    {post.pinned && (
                      <span className="absolute left-0 top-0 h-full w-1.5 bg-yellow-400" />
                    )}
                    <div className={`flex justify-between items-start ${isCompactList ? 'mb-2' : 'mb-4'}`}>
                      <div className="flex-1 pr-4">
                        <p className={`${isCompactList ? 'text-base md:text-xl' : 'text-lg md:text-xl'} font-black text-gray-800 truncate group-hover:text-sky-primary transition-colors flex items-center gap-2`}
                          >
                            {post.pinned && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-200/60 text-yellow-900 font-black border border-yellow-300/60">📌 상단고정</span>
                            )}
                            <span className="truncate">{post.title}</span>
                          </p>
                        <div className={`${isCompactList ? 'mt-1' : 'mt-3'} flex items-center space-x-4 text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider`}>
                          <span className="flex items-center"><i className="fas fa-user-circle mr-2 text-sky-primary/30"></i>{post.author}</span>
                          <span className="flex items-center"><i className="fas fa-eye mr-2"></i>조회 {post.views}</span>
                          {(post.comments?.length || 0) > 0 && (
                            <span className="flex items-center text-sky-500 font-black"><i className="fas fa-comment-dots mr-2"></i>{post.comments?.length}</span>
                          )}
                        </div>
                        {userRole === 'admin' && post.password && (
                          <div className={`${isCompactList ? 'mt-1' : 'mt-2'} text-xs md:text-sm font-black text-red-500`}>
                            비밀번호: {post.password}
                          </div>
                        )}
                      </div>
                      <span className={`${isCompactList ? 'text-[10px] md:text-sm' : 'text-xs md:text-sm'} text-gray-300 font-black whitespace-nowrap pt-1`}>{formatDate(post.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
          <Pagination current={page} total={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
};

export default Board;
