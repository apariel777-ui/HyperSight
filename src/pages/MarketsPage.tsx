import { MarketsTable } from '../components/markets/MarketsTable';
import { useStore } from '../store';
import { AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarkets } from '../api/hyperliquid';

export const MarketsPage = () => {
  const selectedCategory = useStore((s) => s.selectedCategory);

  const { data: markets } = useQuery({
    queryKey: ['markets', selectedCategory],
    queryFn: () => fetchMarkets(selectedCategory),
    refetchInterval: 5000,
  });

  const totalVolume = Array.isArray(markets) 
    ? markets.reduce((acc, m) => acc + (m.volume24h || 0), 0) 
    : 0;
  
  const totalMarkets = Array.isArray(markets) ? markets.length : 0;
  
  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <div className="pt-8 px-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-dark-400">Markets Overview</h1>
            {selectedCategory !== 'Crypto' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                <AlertCircle className="w-3.5 h-3.5" />
                Simulated Data
              </div>
            )}
          </div>
          <p className="text-dark-400 mt-2">
            {selectedCategory === 'Crypto' 
              ? "Trade perpetual futures with deep liquidity and zero gas fees on the L1."
              : `Explore ${selectedCategory} markets with real-time price action and high-frequency data feed.`}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="p-4 glass-panel flex flex-col items-end">
            <span className="text-xs text-dark-400 uppercase font-bold">24h Volume</span>
            <span className="text-lg font-mono text-white">
              {formatVolume(totalVolume)}
            </span>
          </div>
          <div className="p-4 glass-panel flex flex-col items-end">
            <span className="text-xs text-dark-400 uppercase font-bold">Total Markets</span>
            <span className="text-lg font-mono text-brand-neon">{totalMarkets}</span>
          </div>
        </div>
      </div>
      <div className="glass-panel p-1 border-t-brand-neon/20 border-t-2">
        <MarketsTable />
      </div>
    </div>
  );
};
