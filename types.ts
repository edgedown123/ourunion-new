
export type BoardType = 'intro' | 'notice_all' | 'family_events' | 'free' | 'resources' | 'signup' | 'trash';
export type UserRole = 'guest' | 'member' | 'admin';

export interface PostAttachment {
  name: string;
  data: string; // Base64 string
  type: string; // MIME type
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
  content: string;
  author: string;
  /** 작성자 식별자(조합원: member.id, 관리자: 'admin'). 기존 게시물 호환을 위해 optional */
  authorId?: string;
  /** Supabase Auth uid (posts.user_id) */
  userId?: string;
  createdAt: string;
  views: number;
  imageUrl?: string;
  attachments?: PostAttachment[];
  /** (레거시) 게시물 수정/삭제 비밀번호 - 신규 작성에서는 사용하지 않음 */
  password?: string;
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
  phone: string;
  mapImageUrl: string;
}

export interface SiteSettings {
  siteName: string;
  pointColor: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string; // 하위 호환성을 위해 유지
  heroImageUrls: string[]; // 슬라이드쇼를 위한 배열
  fontFamily: string;
  greetingTitle: string;
  greetingMessage: string;
  greetingImageUrl: string;
  missionItems: string[];
  history: HistoryItem[];
  offices: OfficeItem[];
}
