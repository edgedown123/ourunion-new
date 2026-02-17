import React from 'react';
import { SiteSettings } from '../types';

type DispatchArea = 'jinkwan' | 'dobong' | 'songpa';

const AREA_LABEL: Record<DispatchArea, string> = {
  jinkwan: '진관',
  dobong: '도봉',
  songpa: '송파',
};

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

export const DispatchSheetView: React.FC<{
  area: DispatchArea;
  settings: SiteSettings;
}> = ({ area, settings }) => {
  const src = settings.dispatchSheets?.[area] || '';
  const label = AREA_LABEL[area];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-black text-gray-900">배차표 · {label}</h1>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {src ? (
          <div className="w-full">
            <img
              src={src}
              alt={`배차표 ${label}`}
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-4xl text-gray-200 mb-3">
              <i className="fas fa-image" />
            </div>
            <div className="font-black text-gray-900">아직 배차표 이미지가 없어요</div>
            <div className="text-sm text-gray-500 mt-2">관리자 설정에서 {label} 배차표 이미지를 업로드해 주세요.</div>
          </div>
        )}
      </div>
    </div>
  );
};
