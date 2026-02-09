
import { Post, SiteSettings } from './types';

export const INITIAL_SETTINGS: SiteSettings = {
  siteName: '우리노동조합',
  pointColor: '#0ea5e9',
  heroTitle: '함께 만드는 더 나은 내일',
  heroSubtitle: '우리노동조합은 노동자의 권익과 정의로운 노동 환경을 위해 행동합니다.',
  heroImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1200',
  heroImageUrls: [
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200'
  ],
  fontFamily: 'Noto Sans KR',
  greetingTitle: '우리의 사명과 약속',
  greetingMessage: '우리는 공정한 분배와 안전한 작업 환경, 그리고 민주적인 노사 관계를 지향합니다. 모든 노동자가 존중받는 세상을 만드는 것이 우리의 최종 목표입니다.',
  greetingImageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=1200',
  missionItems: [
    '임금 협상 및 근로 조건 개선',
    '고용 안정성 확보 및 부당 해고 대응',
    '조합원 복지 증진 및 교육 지원'
  ],
  history: [
    { year: '2024', text: '우리노동조합 디지털 혁신 선포 및 홈페이지 개편' },
    { year: '2015', text: '전국 단위 노동 환경 실태 조사 실시' },
    { year: '2005', text: '산별 노동조합 체제 전환' },
    { year: '1990', text: '우리노동조합 창립 선언' }
  ],
  offices: [
    {
      id: 'jinkwan',
      name: '진관사업소',
      address: '서울특별시 은평구 통일로 1190',
      phone: '02-371-0709',
      mapImageUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80&w=800'
    },
    {
      id: 'dobong',
      name: '도봉사업소',
      address: '서울특별시 도봉구 도봉로 969',
      phone: '02-987-6543',
      mapImageUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200'
    },
    {
      id: 'songpa',
      name: '송파사업소',
      address: '서울특별시 송파구 헌릉로 869',
      phone: '02-555-5555',
      mapImageUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200'
    }
  ]
};

export const INITIAL_POSTS: Post[] = [
  {
    id: '1',
    // 공지사항(공고/공지) 기본 글
    type: 'notice_all',
    title: '우리노동조합 홈페이지 오픈 안내',
    content: '조합원 여러분의 편리한 소통을 위해 홈페이지를 만들었습니다\n우리노동조합에서는 존댓말 사용이 의무입니다\n서로 존중하는 사회를 만들어 봅시다!',
    author: '관리자',
    createdAt: '2025-12-29',
    views: 124,
    password: '1234'
  }
];

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  children?: { id: string; label: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  { 
    id: 'intro', 
    label: '조합소개', 
    icon: 'fa-info-circle',
    children: [
      { id: 'greeting', label: '인사말' },
      { id: 'history', label: '연혁' },
      { id: 'map', label: '찾아오시는 길' },
    ]
  },

  // ✅ 공지사항(통합)
  { 
    id: 'notice',
    label: '공지사항',
    icon: 'fa-bullhorn',
    children: [
      { id: 'notice_all', label: '공고/공지' },
      { id: 'family_events', label: '경조사' },
    ]
  },

  { id: 'free', label: '자유게시판', icon: 'fa-comments' },
  { id: 'resources', label: '자료실', icon: 'fa-folder-open' },
  { id: 'signup', label: '회원가입', icon: 'fa-user-plus' },
];
