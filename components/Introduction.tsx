
import React from 'react';
import { SiteSettings } from '../types';

interface IntroductionProps {
  settings: SiteSettings;
  activeTab: string;
}

const Introduction: React.FC<IntroductionProps> = ({ settings, activeTab }) => {
  if (activeTab === 'map') {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">찾아오시는 길</h2>
          <div className="h-1 w-20 bg-sky-primary mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {settings.offices.map((office) => (
            <div key={office.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
              <div className="h-48 bg-gray-200 overflow-hidden relative group">
                <img 
                  src={office.mapImageUrl} 
                  alt={`${office.name} 전경`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
              </div>
              <div className="p-6 flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{office.name}</h3>
                <div className="space-y-3">
                  <div className="flex items-start text-sm">
                    <i className="fas fa-map-marker-alt text-sky-primary mt-1 mr-3 flex-shrink-0"></i>
                    <span className="text-gray-600 leading-snug">{office.address}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <i className="fas fa-phone-alt text-sky-primary mr-3 flex-shrink-0"></i>
                    <a href={`tel:${office.phone}`} className="text-gray-900 font-medium hover:text-sky-primary transition-colors">
                      {office.phone}
                    </a>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 mt-auto">
                <a 
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(office.address)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2.5 bg-gray-50 border rounded-lg text-xs font-bold text-gray-600 hover:bg-sky-primary hover:text-white hover:border-sky-primary transition-all"
                >
                  네이버맵으로 보기
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {activeTab === 'history' ? '연혁' : '인사말'}
        </h2>
        <div className="h-1 w-20 bg-sky-primary mx-auto"></div>
        <p className="mt-6 text-lg text-gray-600">
          {settings.siteName}은 노동자의 삶의 질 향상과 권익 보호를 위해 헌신해 왔습니다.
        </p>
      </div>

      {(activeTab === 'intro' || activeTab === 'greeting') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <img 
              src={settings.greetingImageUrl || "https://picsum.photos/600/400?random=2"} 
              alt="Greeting" 
              className="rounded-2xl shadow-xl border w-full object-cover aspect-[3/2]"
            />
          </div>
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">{settings.greetingTitle}</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {settings.greetingMessage}
            </p>
            <ul className="space-y-3">
              {(settings.missionItems || []).map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <i className="fas fa-check-circle text-sky-primary mt-1 mr-3"></i>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(activeTab === 'intro' || activeTab === 'history') && (
        <div className="bg-sky-50 rounded-[3rem] p-8 sm:p-12">
          <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">주요 연혁</h3>
          <div className="space-y-8">
            {settings.history && settings.history.length > 0 ? (
              settings.history.map((item, idx) => (
                <div key={idx} className="flex border-l-2 border-sky-primary pl-6 relative">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-sky-primary border-4 border-white shadow-sm"></div>
                  <div className="pb-2">
                    <span className="font-black text-sky-800 text-sm">{item.year}</span>
                    <p className="text-gray-700 mt-1 font-medium">{item.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-10">등록된 연혁 정보가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Introduction;
