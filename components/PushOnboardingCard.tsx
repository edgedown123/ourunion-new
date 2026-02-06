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
      alert('알림이 켜졌습니다! 새 글이 올라오면 알려드릴게요.');
      onDone();
    } catch (e: any) {
      const msg = e?.message || String(e);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-4 md:px-0 mt-6">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0">
                <i className="fas fa-bell text-sky-600 text-xl" />
              </div>

              <div className="flex-1">
                <p className="text-gray-900 font-black text-lg md:text-xl">
                  {memberName ? `${memberName}님, 가입 승인 완료 🎉` : '가입 승인 완료 🎉'}
                </p>
                <p className="text-gray-500 mt-1 leading-relaxed">
                  자유게시판에 새 글이 올라오면 바로 알려드릴게요.
                  <span className="hidden md:inline"> (폰/PC 각각 한 번만 설정하면 됩니다)</span>
                </p>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleEnable}
                    disabled={loading}
                    className="px-6 py-3 rounded-2xl bg-gray-900 text-white font-black shadow-lg active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? '설정 중...' : '🔔 알림 받기'}
                  </button>

                  <button
                    onClick={onLater}
                    disabled={loading}
                    className="px-6 py-3 rounded-2xl bg-gray-50 text-gray-700 font-bold border border-gray-200 active:scale-[0.99] transition disabled:opacity-60"
                  >
                    나중에
                  </button>
                </div>

                <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                  * 알림은 로그인한 조합원에게만 제공됩니다. 브라우저/기기마다 별도로 설정이 필요할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PushOnboardingCard;
