
import React, { useState, useEffect } from 'react';

interface HeroProps {
  title: string;
  subtitle: string;
  imageUrls: string[];
  onJoinClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ title, subtitle, imageUrls, onJoinClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 이미지가 없을 경우 대비
  const displayImages = imageUrls && imageUrls.length > 0 
    ? imageUrls.filter(url => !!url) 
    : ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1200'];

  useEffect(() => {
    if (displayImages.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    }, 3000); // 3초마다 전환

    return () => clearInterval(timer);
  }, [displayImages.length]);

  return (
    <div className="flex flex-col">
      <section className="relative bg-white lg:flex lg:items-center lg:min-h-[600px] xl:min-h-[700px] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center w-full py-12 lg:py-0">
          
          {/* 텍스트 영역 */}
          <div className="w-full lg:w-1/2 lg:pr-12 mb-10 lg:mb-0 text-center lg:text-left z-10">
            <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl animate-fadeIn">
              <span className="block xl:inline leading-tight">{title.split(' ')[0]}</span>{' '}
              <span className="block text-sky-primary xl:inline leading-tight">
                {title.split(' ').slice(1).join(' ')}
              </span>
            </h1>
            <p className="mt-6 text-base text-gray-500 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-8 md:text-xl lg:mx-0 font-medium leading-relaxed">
              {subtitle}
            </p>
            <div className="mt-10 sm:flex sm:justify-center lg:justify-start">
              <div className="rounded-2xl shadow-2xl shadow-sky-100">
                <button
                  onClick={onJoinClick}
                  className="w-full flex items-center justify-center px-10 py-4 border border-transparent text-base font-black rounded-2xl text-white bg-sky-primary hover:bg-sky-600 md:py-5 md:text-lg md:px-14 transition-all active:scale-95 transform"
                >
                  조합 가입 신청하기
                </button>
              </div>
            </div>
          </div>

          {/* 이미지 영역: 슬라이드쇼 및 하단 인디케이터 */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-end animate-fadeIn">
            <div className="relative w-full max-w-2xl lg:max-w-none aspect-[4/3] lg:aspect-square xl:aspect-[16/10] overflow-hidden rounded-[2.5rem] shadow-2xl border-8 border-white bg-gray-100">
              {displayImages.map((url, index) => (
                <img
                  key={index}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                    index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'
                  }`}
                  src={url}
                  alt={`Slide ${index + 1}`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-primary/10 to-transparent pointer-events-none"></div>
            </div>

            {/* 슬라이드 인디케이터 (Dots) - 사진 아래 위치 */}
            {displayImages.length > 1 && (
              <div className="mt-6 flex space-x-2.5 z-20">
                {displayImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2.5 transition-all duration-500 rounded-full ${
                      index === currentIndex 
                        ? 'w-10 bg-sky-primary shadow-lg shadow-sky-100' 
                        : 'w-2.5 bg-gray-200 hover:bg-gray-300'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 배경 장식 요소 */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-sky-50 rounded-full blur-3xl opacity-50 -z-10"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-sky-50 rounded-full blur-3xl opacity-50 -z-10"></div>
      </section>
    </div>
  );
};

export default Hero;
