import React, { useEffect, useRef } from "react";
import Board from "./Board";
import { Post, BoardType, UserRole, Comment } from "../types";

interface NoticeCombinedProps {
  posts: Post[];
  userRole: UserRole;
  activeTab: string; // 'notice_all' | 'family_events' (and parent 'notice' is normalized in App)
  selectedPostId: string | null;

  onWriteClick: (specificType?: BoardType) => void;
  onEditClick: (post: Post) => void;
  onSelectPost: (id: string | null) => void;
  onDeletePost: (postId: string, inputPassword?: string) => void;

  onSaveComment: (postId: string, content: string, parentId?: string) => void;
  onEditComment: (postId: string, commentId: string, content: string, parentId?: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
}

const NoticeCombined: React.FC<NoticeCombinedProps> = ({
  posts,
  userRole,
  activeTab,
  selectedPostId,
  onWriteClick,
  onEditClick,
  onSelectPost,
  onDeletePost,
  onSaveComment,
  onEditComment,
  onDeleteComment,
}) => {
  const generalRef = useRef<HTMLDivElement | null>(null);
  const familyRef = useRef<HTMLDivElement | null>(null);

  // 하위 탭(공고/공지 or 경조사)을 눌렀을 때 해당 섹션으로 스크롤
  useEffect(() => {
    // 탭 전환 시(공지사항 > 공고/공지, 경조사 포함) 페이지 스크롤을 항상 최상단으로 고정합니다.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // 일부 브라우저 호환
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* 한 화면에 '공고/공지' + '경조사' 섹션을 가로로 배치 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div id="notice-section-general" ref={generalRef} className="scroll-mt-24">
          <div className="mb-3" />

          <Board
              type={"notice_all" as BoardType}
              posts={posts}
              onWriteClick={() => onWriteClick("notice_all")}
              onEditClick={onEditClick}
              selectedPostId={selectedPostId}
              onSelectPost={onSelectPost}
              userRole={userRole}
              onDeletePost={onDeletePost}
              onSaveComment={onSaveComment}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
            />
          </div>
        </div>

        <div id="notice-section-family" ref={familyRef} className="scroll-mt-24">
          <div className="mb-3" />

          <Board
              type={"family_events" as BoardType}
              posts={posts}
              onWriteClick={() => onWriteClick("family_events")}
              onEditClick={onEditClick}
              selectedPostId={selectedPostId}
              onSelectPost={onSelectPost}
              userRole={userRole}
              onDeletePost={onDeletePost}
              onSaveComment={onSaveComment}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoticeCombined;
