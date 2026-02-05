
import React, { useState } from 'react';
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
  onDeletePost?: (id: string, password?: string) => void;
  onSaveComment?: (postId: string, content: string, parentId?: string) => void;
  onEditComment?: (postId: string, commentId: string, content: string, parentId?: string) => void;
  onDeleteComment?: (postId: string, commentId: string, parentId?: string) => void;
  currentUserName?: string;
}

const Board: React.FC<BoardProps> = ({ 
  type, posts, onWriteClick, onEditClick, selectedPostId, 
  onSelectPost, userRole, onDeletePost, onSaveComment, onEditComment, onDeleteComment, currentUserName 
}) => {
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isEditVerifyMode, setIsEditVerifyMode] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ commentId: string; parentId?: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  
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

  const handleEditAttempt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPost) return;

    setIsEditVerifyMode(true);
    setIsDeleteMode(false);
    setVerifyPassword('');
  };

  const handleDeleteAttempt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPost || !onDeletePost) return;

    setIsDeleteMode(true);
    setIsEditVerifyMode(false);
    setVerifyPassword('');
  };

  const handleConfirmVerify = () => {
    if (!selectedPost) return;
    // ✅ 관리자 포함: 수정/삭제 시에는 항상 게시물 비밀번호 확인
    if (verifyPassword !== selectedPost.password) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (isEditVerifyMode) {
      onEditClick(selectedPost);
      setIsEditVerifyMode(false);
    } else if (isDeleteMode) {
      onDeletePost?.(selectedPost.id, verifyPassword);
      setIsDeleteMode(false);
    }
    setVerifyPassword('');
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

  // 상세 보기 모드
  if (selectedPost) {
    const imageAttachments = selectedPost.attachments?.filter(a => a.type.startsWith('image/')) || [];


const renderContentWithInlineImages = (raw: string) => {
  const parts = raw.split(/\[\[img:(\d+)\]\]/g);
  const used = new Set<number>();
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) nodes.push(<span key={`t-${i}`} className="whitespace-pre-wrap">{parts[i]}</span>);
    } else {
      const idx = Number(parts[i]);
      if (!Number.isNaN(idx) && imageAttachments[idx]) {
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

  return { nodes, used };
};
    const hasPassword = !!selectedPost.password;
    const isNoticeCategory = selectedPost.type === 'notice_all' || selectedPost.type === 'family_events';

    return (
      <div className="max-w-4xl mx-auto py-8 px-2 sm:px-5 animate-fadeIn">
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => onSelectPost(null)} className="flex items-center text-gray-500 hover:text-sky-primary group font-bold">
            <i className="fas fa-arrow-left mr-2 group-hover:-translate-x-1 transition-transform"></i> 목록으로
          </button>
          
          <div className="flex space-x-2">
            {(userRole === 'admin' || (hasPassword && !isDeleteMode && !isEditVerifyMode)) && (
              <>
                <button 
                  onClick={handleEditAttempt} 
                  className="flex items-center font-black text-xs px-5 py-3 rounded-2xl bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all shadow-md active:scale-95 border border-sky-100"
                >
                  <i className="fas fa-edit mr-2"></i> 수정
                </button>
                <button 
                  onClick={handleDeleteAttempt} 
                  className="flex items-center font-black text-xs px-5 py-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-all shadow-md active:scale-95 border border-red-100"
                >
                  <i className="fas fa-trash-alt mr-2"></i> 삭제
                </button>
              </>
            )}
          </div>
        </div>

        <article className="bg-white rounded-[2.5rem] border p-10 md:p-14 shadow-sm relative overflow-hidden mb-10">
          {(isDeleteMode || isEditVerifyMode) && (
            <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md flex items-center justify-center p-8">
              <div className="max-w-xs w-full text-center">
                <i className={`fas ${isEditVerifyMode ? 'fa-key' : 'fa-lock'} text-5xl ${isEditVerifyMode ? 'text-sky-500' : 'text-red-500'} mb-5`}></i>
                <h4 className="text-xl font-black mb-4">{isEditVerifyMode ? '수정 비밀번호' : '삭제 비밀번호'}</h4>
                <input 
                  type="password" 
                  value={verifyPassword} 
                  onChange={(e) => setVerifyPassword(e.target.value)} 
                  className={`w-full border-2 rounded-2xl p-4 mb-6 text-center text-xl tracking-widest outline-none focus:border-opacity-100 ${isEditVerifyMode ? 'border-sky-100 focus:border-sky-500' : 'border-red-100 focus:border-red-500'}`} 
                  placeholder="****" 
                  autoFocus 
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmVerify()}
                />
                <div className="flex space-x-3">
                  <button onClick={() => { setIsDeleteMode(false); setIsEditVerifyMode(false); }} className="flex-1 py-4 bg-gray-100 rounded-2xl text-sm font-black">취소</button>
                  <button onClick={handleConfirmVerify} className={`flex-1 py-4 text-white rounded-2xl text-sm font-black shadow-lg ${isEditVerifyMode ? 'bg-sky-500' : 'bg-red-500'}`}>확인</button>
                </div>
              </div>
            </div>
          )}

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
                  <p className="text-base text-gray-600 leading-relaxed pl-11 mb-3">{comment.content}</p>
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
                        <p className="text-sm text-gray-500 leading-relaxed pl-7">{reply.content}</p>
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
    const noticeAllPosts = posts.filter(p => p.type === 'notice_all').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    const familyEventPosts = posts.filter(p => p.type === 'family_events').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    const PostList = ({ title, icon, colorClass, data }: { title: string, icon: string, colorClass: string, data: Post[] }) => (
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
                  <button onClick={() => onSelectPost(post.id)} className="w-full text-left p-6 hover:bg-gray-50 transition-colors group">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-gray-700 truncate group-hover:text-sky-primary transition-colors flex-1 mr-4">{post.title}</p>
                      <span className="text-[11px] text-gray-300 font-black whitespace-nowrap">{formatDate(post.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
        <PostList title="공고/공지" icon="fa-bullhorn" colorClass="bg-sky-primary text-white" data={noticeAllPosts} />
        <PostList title="경조사" icon="fa-bullhorn" colorClass="bg-sky-primary text-white" data={familyEventPosts} />
      </div>
    );
  };

  const filteredPosts = posts.filter(p => p.type === type).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 모바일에서 일부 게시판 목록을 더 촘촘하게(행 높이/여백 축소)
  // - 자유게시판/자료실
  // - 공지사항 하위 탭(공고/공지, 경조사)
  const isCompactList =
    type === 'free' ||
    type === 'resources' ||
    type === 'notice_all' ||
    type === 'family_events';

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
        {userRole !== 'guest' && (userRole === 'admin' || type === 'free') && type !== 'notice' && (
          <button 
            onClick={() => onWriteClick()} 
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
              filteredPosts.map((post) => (
                <li key={post.id}>
                  <button
                    onClick={() => onSelectPost(post.id)}
                    className={`block w-full text-left hover:bg-gray-50/40 transition-all group ${isCompactList ? 'p-4 md:p-8' : 'p-8 md:p-10'}`}
                  >
                    <div className={`flex justify-between items-start ${isCompactList ? 'mb-2' : 'mb-4'}`}>
                      <div className="flex-1 pr-4">
                        <p className={`${isCompactList ? 'text-base md:text-xl' : 'text-lg md:text-xl'} font-black text-gray-800 truncate group-hover:text-sky-primary transition-colors`}>{post.title}</p>
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
        </div>
      )}
    </div>
  );
};

export default Board;