import React from 'react';

export const DispatchLanding: React.FC<{ onSelect: (tab: string) => void }> = ({ onSelect }) => {
  const items: { id: string; label: string }[] = [
    { id: 'dispatch_jinkwan', label: '진관' },
    { id: 'dispatch_dobong', label: '도봉' },
    { id: 'dispatch_songpa', label: '송파' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black text-gray-900">배차표</h1>
      <p className="mt-2 text-sm text-gray-500">사업소를 선택하면 배차표 이미지를 볼 수 있어요.</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-left hover:bg-gray-50 active:scale-[0.99] transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-gray-900">{it.label}</span>
              <i className="fas fa-chevron-right text-gray-300" />
            </div>
            <div className="mt-1 text-xs text-gray-500">배차표 보기</div>
          </button>
        ))}
      </div>
    </div>
  );
};
