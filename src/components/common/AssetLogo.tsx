import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

interface AssetLogoProps {
  symbol: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STOCK_LOGOS: Record<string, string> = {
  NVDA: 'https://logo.clearbit.com/nvidia.com',
  TSLA: 'https://logo.clearbit.com/tesla.com',
  AAPL: 'https://logo.clearbit.com/apple.com',
  MSFT: 'https://logo.clearbit.com/microsoft.com',
  AMZN: 'https://logo.clearbit.com/amazon.com',
  GOOGL: 'https://logo.clearbit.com/google.com',
  META: 'https://logo.clearbit.com/meta.com',
  NFLX: 'https://logo.clearbit.com/netflix.com',
  AMD: 'https://logo.clearbit.com/amd.com',
  PLTR: 'https://logo.clearbit.com/palantir.com',
  GOLD: 'https://cdn-icons-png.flaticon.com/512/272/272534.png',
  SILVER: 'https://cdn-icons-png.flaticon.com/512/3222/3222384.png',
  OIL: 'https://cdn-icons-png.flaticon.com/512/2810/2810057.png',
  SPX: 'https://logo.clearbit.com/standardandpoors.com',
  NDX: 'https://logo.clearbit.com/nasdaq.com',
  DJI: 'https://logo.clearbit.com/dowjones.com',
};

// Fallback search order for Crypto
const CRYPTO_LOGO_SOURCES = [
  (s: string) => `https://bin.bnbstatic.com/static/assets/logos/${s}.png`,
  (s: string) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${s.toLowerCase()}.png`,
  () => `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png`, // Generic trustwallet
];

export const AssetLogo: React.FC<AssetLogoProps> = ({ symbol, className, size = 'md' }) => {
  const baseSymbol = symbol.split('/')[0].toUpperCase();
  const [sourceIndex, setSourceIndex] = useState(0);
  const [error, setError] = useState(false);
  
  const isStock = !!STOCK_LOGOS[baseSymbol];
  
  // Reset when symbol changes
  useEffect(() => {
    setSourceIndex(0);
    setError(false);
  }, [baseSymbol]);

  const getUrl = () => {
    if (isStock) return STOCK_LOGOS[baseSymbol];
    return CRYPTO_LOGO_SOURCES[sourceIndex](baseSymbol);
  };

  const handleError = () => {
    if (isStock) {
       setError(true);
    } else {
       if (sourceIndex < CRYPTO_LOGO_SOURCES.length - 1) {
         setSourceIndex(prev => prev + 1);
       } else {
         setError(true);
       }
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  if (error) {
    return (
      <div className={clsx(
        "flex-shrink-0 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center font-black text-white uppercase tracking-tighter transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]",
        sizeClasses[size],
        className
      )}>
        {baseSymbol.charAt(0)}
      </div>
    );
  }

  return (
    <div className={clsx("relative flex-shrink-0 group", sizeClasses[size], className)}>
      <img
        src={getUrl()}
        alt={symbol}
        className="w-full h-full rounded-full object-cover border border-dark-800/50 group-hover:border-brand-neon/30 transition-all bg-dark-900"
        onError={handleError}
      />
      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] pointer-events-none" />
    </div>
  );
};
