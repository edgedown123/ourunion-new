export type BoardType = 'intro' | 'notice_all' | 'family_events' | 'free' | 'resources' | 'signup' | 'trash';
export type UserRole = 'guest' | 'member' | 'admin';

/**
 * ✅ 첨부파일 모델 (Supabase Storage 기반)
 * - DB에는 Base64(dataURL) 저장 금지
 * - url/path만 저장합니다.
 * - data는 레거시 호환(과거 Base64 저장분)용으로만 optional로 남겨둡니다.
 */
export interface PostAttachment {
  name: string;
  type: string; // MIME type
  url: string; // public URL (or signed URL)
  path?: string; // storage path (삭제/정리용)
  size?: number; // bytes
  data?: string; // (legacy only) dataURL(base64)
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  replies?: Comment[]; // 대댓글(답글) 목록
}

export interface Post {
  id: string;
  type: BoardType;
  title: string;
  /** 목록에서는 content를 내려받지 않을 수 있음(경량화) */
  content?: string;
  author: string;
  /** 작성자 식별자(권장: Supabase Auth user.id) */
  authorId?: string;
  createdAt: string;
  views: number;
  imageUrl?: string;
  /** 목록에서는 attachments를 내려받지 않을 수 있음(경량화) */
  attachments?: PostAttachment[];
  /** (레거시) 게시물 수정/삭제 비밀번호 - 신규 작성에서는 사용하지 않음 */
  password?: string;
  /** 목록에서는 comments를 내려받지 않을 수 있음(경량화) */
  comments?: Comment[]; // 댓글 목록
  pinned?: boolean; // 상단고정 여부
  pinnedAt?: string | null; // 상단고정 시각(정렬용)
}

export interface Member {
  id: string;
  loginId?: string; // 로그인 정보 제거 대응을 위해 선택 사항으로 변경
  password?: string; 
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  garage: string;
  signupDate: string;
  isApproved?: boolean; // 가입 승인 여부
}

export interface HistoryItem {
  year: string;
  text: string;
}

export interface OfficeItem {
  id: string;
  name: string;
  address: string;
}
