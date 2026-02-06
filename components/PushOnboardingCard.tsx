import React, { useState } from 'react';
import { ensurePushSubscribed, isPushSupported } from '../services/pushService';

type Props = {
  memberName?: string;
  onDone: () => void;
  onLater: () => void;
};

/**
 * 승인 완료된 조합원이 "첫 방문"(또는 일정 기간 후 재노출) 때
 * 웹푸시 구독을 쉽게 켤 수 있도록 하는 홈 화면 온보딩 카드
 */
const PushOnboardingCard: React.FC<Props> = ({ memberName, onDone, onLater }) => {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    try {
      if (!isPushSupported()) {
        alert('이 브라우저는 푸시 알림을 지원하지 않습니다. (Chrome/Edge 권장)');
        return;
      }

      setLoading(true);
      await ensurePushSubscribed({ requireAuth: true });
      alert('알림이 켜졌습니다! 우리노동조합에 새 글이 올라오면 알려드릴게요.');
      onDone();
    } catch (e: any) {
      const msg = e?.message || String(e);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // 기존 "회원 전용 메뉴입니다" 모달(앱 전반 팝업)과 비슷한 느낌으로: 오버레이 + 큰 라운드 + 가운데 정렬
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-[560px] rounded-[44px] bg-white shadow-2xl overflow-hidden">
        {/* 닫기 */}
        <button
          type="button"
          onClick={onLater}
          disabled={loading}
          className="absolute right-6 top-6 text-gray-300 hover:text-gray-400 transition"
          aria-label="닫기"
        >
          <i className="fas fa-times text-2xl" />
        </button>

        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center">
            <i className="fas fa-bell text-sky-600 text-3xl" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {memberName ? `${memberName}님, 가입 승인 완료 🎉` : '가입 승인 완료 🎉'}
          </h2>

          <p className="mt-3 text-gray-500 leading-relaxed">
            우리노동조합에 새 글이 올라오면 바로 알려드릴게요.
            <span className="block text-sm mt-1">(폰/PC 각각 한 번만 설정하면 됩니다)</span>
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full px-6 py-4 rounded-3xl bg-gray-900 text-white font-black shadow-lg active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '설정 중...' : '🔔 알림 받기'}
            </button>

            <button
              onClick={onLater}
              disabled={loading}
              className="w-full px-6 py-4 rounded-3xl bg-gray-50 text-gray-700 font-bold border border-gray-200 active:scale-[0.99] transition disabled:opacity-60"
            >
              나중에
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-400 leading-relaxed">
            * 알림은 로그인한 조합원에게만 제공됩니다. 브라우저/기기마다 별도로 설정이 필요할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PushOnboardingCard;
