import React from 'react';
import brandLogo from '../assets/images/logo.png';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  const sizeClasses = {
    xs: 'w-8 h-8 rounded-lg',
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
    lg: 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl',
    xl: 'w-44 h-44 sm:w-52 sm:h-52 rounded-3xl',
    '2xl': 'w-56 h-56 sm:w-64 sm:h-64 rounded-3xl',
  };

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <div
        className={`relative ${sizeClasses[size]} aspect-square overflow-hidden shadow-2xl shadow-black/60 border border-amber-500/40 ring-1 ring-amber-500/20 bg-transparent shrink-0 flex items-center justify-center select-none pointer-events-none transition-transform duration-200`}
        title="شعار سلسلة مطاعم عروس دمشق الرسمي"
      >
        <img
          src={brandLogo}
          alt="شعار سلسلة مطاعم عروس دمشق"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      </div>

      {showText && (
        <div className="flex flex-col text-right select-none">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-white text-base sm:text-lg leading-tight">
              سلسلة مطاعم عروس دمشق
            </span>
            <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-md">
              AL AWAEI 1
            </span>
          </div>
          <span className="text-xs text-amber-300/90 font-medium mt-0.5">
            Good Food • المنظومة الرقابية للإيصالات
          </span>
        </div>
      )}
    </div>
  );
};
