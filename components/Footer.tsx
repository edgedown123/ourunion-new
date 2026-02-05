import { useMemo, useState } from "react";
import PolicyModal from "./PolicyModal";

interface FooterProps {
  siteName?: string;
  onTabChange?: (tab: string) => void;
  youtubeLinks?: { label: string; url: string }[];
  showWithdrawButton?: boolean;
  onRequestWithdraw?: () => void;
}

export default function Footer({
  siteName = "우리노동조합",
  youtubeLinks = [],
  showWithdrawButton = false,
  onRequestWithdraw,
}: FooterProps) {
  const [open, setOpen] = useState<null | "privacy" | "email">(null);

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

  const privacyText = useMemo(
    () => `우리노동조합(이하 “조합”)은 개인정보 보호법 등 관련 법령을 준수하며,
조합원의 개인정보를 소중하게 보호하고 있습니다.

1. 수집하는 개인정보 항목
조합은 다음과 같은 개인정보를 수집할 수 있습니다.
- 이름
- 이메일 주소
- 연락처
- 아이디(회원 가입 시)
- 서비스 이용 기록, 접속 로그

2. 개인정보의 수집 및 이용 목적
수집한 개인정보는 다음 목적을 위해 사용됩니다.
- 조합 가입 및 회원 관리
- 공지사항 전달 및 조합 활동 안내
- 문의사항 응대 및 민원 처리
- 서비스 개선 및 운영 관리

3. 개인정보의 보유 및 이용 기간
- 개인정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다.
- 단, 관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.

4. 개인정보의 제3자 제공
조합은 원칙적으로 개인정보를 외부에 제공하지 않습니다.
다만, 법령에 따라 요구되는 경우에 한해 제공될 수 있습니다.

5. 개인정보 보호를 위한 조치
조합은 개인정보 보호를 위해 다음과 같은 조치를 취하고 있습니다.
- 개인정보 접근 권한 최소화
- 내부 관리 절차 수립 및 운영
- 개인정보 유출 방지를 위한 기술적 보호조치

6. 개인정보 관련 문의
개인정보 보호와 관련한 문의는 아래 이메일로 연락 주시기 바랍니다.
이메일: edgedown@naver.com

본 방침은 2026년 1월 1일부터 적용됩니다.`,
    []
  );

  const emailPolicyText = useMemo(
    () => `우리노동조합은 본 웹사이트에 게시된 이메일 주소가
전자우편 수집 프로그램이나 기타 기술적 장치를 이용하여
무단으로 수집되는 것을 거부합니다.

이를 위반할 경우 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 의해
형사 처벌 대상이 될 수 있습니다.

조합의 사전 동의 없이 영리 목적의 광고성 이메일을 발송하는 행위를 금지합니다.`,
    []
  );

  return (
    <footer className="bg-gray-100 text-gray-500 text-sm px-4 py-8">
      <div className="max-w-6xl mx-auto md:flex md:items-start md:justify-between md:gap-10">
        <div className="space-y-2 text-center md:text-left">
        <p className="font-semibold text-gray-700">우리노동조합</p>

        <p>서울특별시 은평구 통일로 1190 진관버스공영차고지</p>

        <p>
          TEL: 02-123-4567&nbsp;&nbsp; FAX: 02-1234-5678
        </p>

        <p>EMAIL: edgedown@naver.com</p>

        <p className="pt-4 text-xs text-gray-400">
          Copyright © 2025 우리노동조합. All rights reserved.
        </p>

        <div className="pt-2 flex justify-center md:justify-start gap-6 text-sm">
          <button type="button" onClick={() => setOpen("privacy")} className="hover:underline">
            개인정보처리방침
          </button>
          <button type="button" onClick={() => setOpen("email")} className="hover:underline">
            이메일무단수집거부
          </button>
        </div>
        </div>
  {/* 데스크톱 우측 하단 영역: 유튜브 링크 + 회원탈퇴 */}
  <div className="hidden md:flex md:flex-col md:items-end md:gap-3 md:min-w-[320px]">
    {youtubeLinks.length > 0 && (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-[360px]">
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
                <div className="w-full h-[60px] sm:h-[64px] md:h-[72px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 transition-all">
                  <img src={src} alt={it.label} className="w-full h-full object-contain" />
                </div>
              ) : (
                <span
                  className="w-full h-[60px] sm:h-[64px] md:h-[72px] rounded-2xl text-white font-black text-sm shadow-md text-center flex items-center justify-center"
                  style={{ backgroundColor: "var(--point-color)" }}
                >
                  {it.label}
                </span>
              )}
            </a>
          );
        })}
        {showWithdrawButton && (
          <button
            type="button"
            onClick={() => onRequestWithdraw?.()}
            className="w-full"
          >
            <div className="w-full h-[60px] sm:h-[64px] md:h-[72px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 transition-all">
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
        onClick={() => onRequestWithdraw?.()}
        className="w-full max-w-[360px]"
      >
        <div className="w-full h-[60px] sm:h-[64px] md:h-[72px] rounded-2xl shadow-md overflow-hidden bg-white hover:brightness-95 transition-all">
          <img
            src="/images/youtube-회원탈퇴.png"
            alt="회원 탈퇴"
            className="w-full h-full object-contain"
          />
        </div>
      </button>
    )}
  </div>

</div>

<PolicyModal isOpen={open === "privacy"} title="개인정보처리방침" onClose={() => setOpen(null)}>
        {privacyText}
      </PolicyModal>

      <PolicyModal isOpen={open === "email"} title="이메일무단수집거부" onClose={() => setOpen(null)}>
        {emailPolicyText}
      </PolicyModal>
    </footer>
  );
}
