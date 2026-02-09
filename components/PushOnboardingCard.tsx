import React, { useState } from 'react';
import { ensurePushSubscribed, isPushSupported } from '../services/pushService';

type Variant = 'approved' | 'reminder';

type Props = {
  memberName?: string;
  onDone: () => void;
  onLater: () => void;
  variant?: Variant;
};

const UI = {
  approved: {
    title: (name?: string) => `${name ?? ''}님, 가입 승인 완료 🎉`.trim(),
    desc: '우리노동조합에 새 글이 올라오면 바로 알려드릴게요.',
    primary: '🔔 알림 받기',
    secondary: '나중에',
    footer: '* 알림은 로그인한 조합원에게만 제공됩니다. 브라우저/기기마다 별도로 설정이 필요할 수 있습니다.',
  },
  reminder: {
    title: () => '새글 알림이 꺼져 있어요. 다시 켤까요?',
    desc: '새 글이 올라오면 바로 알려드릴게요.',
    primary: '🔔 알림 켜기',
    secondary: '나중에',
    footer: '* 알림은 로그인한 조합원에게만 제공됩니다. 브라우저/기기마다 별도로 설정이 필요할 수 있습니다.',
  },
} as const;

const PushOnboardingCard: React.FC<Props> = ({ memberName, onDone, onLater, variant = 'approved' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    try {
      setLoading(true);
      setError(null);

      const supported = await isPushSupported();
      if (!supported) {
        throw new Error('이 기기/브라우저에서는 푸시 알림을 지원하지 않습니다.');
      }

      // 알림 권한 + 푸시 구독 + 서버 저장
      await ensurePushSubscribed();

      onDone();
    } catch (e: any) {
      setError(e?.message ?? '알림 설정 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const ui = UI[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-10 text-center relative">
          <button
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            onClick={onLater}
            aria-label="닫기"
          >
            <i className="fas fa-times text-2xl" />
          </button>

          <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center">
            <i className="fas fa-bell text-sky-600 text-3xl" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {variant === 'approved' ? ui.title(memberName) : ui.title()}
          </h2>

          <p className="mt-3 text-gray-500 leading-relaxed">{ui.desc}</p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full px-6 py-4 rounded-3xl bg-gray-900 text-white font-black shadow-lg active:scale-[0.99] transition disabled:opacity-60"
            >
              {loading ? '설정 중...' : ui.primary}
            </button>

            <button
              onClick={onLater}
              disabled={loading}
              className="w-full px-6 py-4 rounded-3xl bg-gray-50 text-gray-700 font-bold border border-gray-200 active:scale-[0.99] transition disabled:opacity-60"
            >
              {ui.secondary}
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <p className="mt-6 text-xs text-gray-400 leading-relaxed">{ui.footer}</p>
        </div>
      </div>
    </div>
  );
};

export default PushOnboardingCard;
