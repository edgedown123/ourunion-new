import React from "react";
import Board from "./Board";
import { Post, BoardType, UserRole } from "../types";

interface NoticeSingleProps {
  posts: Post[];
  userRole: UserRole;
  type: BoardType;
  selectedPostId: string | null;
  onWriteClick: (specificType?: BoardType) => void;
  onEditClick: (post: Post) => void;
  onSelectPost: (id: string | null) => void;
  onDeletePost: (postId: string, inputPassword?: string) => void;
  onSaveComment: (postId: string, content: string, parentId?: string) => void;
  onEditComment: (post: string, commentId: string, content: string, parentId?: string) => void;
  onDeleteComment: (post: string, commentId: string, parentId?: string) => void;
}

const NoticeSingle: React.FC<NoticeSingleProps> = ({
  posts,
  userRole,
  type,
  selectedPostId,
  onWriteClick,
  onEditClick,
  onSelectPost,
  onDeletePost,
  onSaveComment,
  onEditComment,
  onDeleteComment,
}) => {
  return (
    <div className="scroll-mt-24">
      {/*
        공지/경조사(NoticeSingle)는 내부에서 <Board />를 그대로 렌더링한다.
        Board 자체가 이미 max-width/spacing(예: py-10, px-4)를 가지고 있어서,
        여기서 다시 max-w/py를 주면 자유게시판 대비 상단 여백이 2중으로 들어가
        레이아웃 폭/간격이 달라 보인다.
      */}
      <Board
        type={type}
        posts={posts}
        onWriteClick={() => onWriteClick(type)}
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
  );
};

export default NoticeSingle;
