
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
  createdAt: string;
  views: number;
  imageUrl?: string;
  attachments?: PostAttachment[];
  password?: string; // 자유게시판 삭제용 비번
  comments?: Comment[]; // 댓글 목록
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
