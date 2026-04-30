import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarkets } from '../../api/hyperliquid';
import { useStore } from '../../store';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { AssetLogo } from '../common/AssetLogo';
import clsx from 'clsx';

export const Watchlist = () => {
  const selectedMarket = useStore((s) => s.selectedMarket);
  const setSelectedMarket = useStore((s) => s.setSelectedMarket);
  const selectedCategory = useStore((s) => s.selectedCategory);
  const setSelectedCategory = useStore((s) => s.setSelectedCategory);
  
  const [search, setSearch] = useState('');

  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets', selectedCategory],
    queryFn: () => fetchMarkets(selectedCategory),
    refetchInterval: 3000,
  });

  const categories = ['Crypto', 'Stocks', 'Indices', 'Commodities'] as const;

  const filteredMarkets = markets?.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-dark-950 border-l border-dark-800/50">
      <div className="p-3 border-b border-dark-800/50">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-dark-400">Watchlist</span>
          <span className="text-[10px] text-dark-500 font-mono">{markets?.length || 0} Assets</span>
        </div>

        {/* CATEGORY TABS */}
        <div className="flex gap-1 mb-3 p-1 bg-dark-900/50 rounded-lg overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                // When switching categories, pick the first asset of the new category or stay on current if it exists
              }}
              className={clsx(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                selectedCategory === cat 
                  ? "bg-dark-800 text-brand-neon border border-brand-neon/20 shadow-[0_0_10px_rgba(0,255,163,0.05)]"
                  : "text-dark-500 hover:text-white hover:bg-dark-800/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
          <input
            type="text"
            placeholder={`Search ${selectedCategory}...`}
            className="w-full bg-dark-900 border border-dark-800 rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-brand-neon/50 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-10 bg-dark-900 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-dark-900/50">
            <div className="grid grid-cols-3 px-4 py-2 text-[10px] uppercase font-bold text-dark-500 tracking-tighter sticky top-0 bg-dark-950 z-10 shadow-sm border-b border-dark-900">
              <span>Symbol</span>
              <span className="text-right">Last</span>
              <span className="text-right">Chg%</span>
            </div>
            {filteredMarkets?.map((m) => (
              <button
                key={m.name}
                onClick={() => setSelectedMarket(m.name)}
                className={clsx(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-all group",
                  selectedMarket === m.name ? "bg-dark-800 border border-brand-neon/20 shadow-[0_0_15px_rgba(0,255,163,0.05)]" : "hover:bg-dark-900 border border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <AssetLogo symbol={m.name} size="sm" />
                  <div className="text-left">
                    <div className={clsx("text-[11px] font-black uppercase tracking-tight", selectedMarket === m.name ? "text-brand-neon" : "text-white")}>{m.name}</div>
                    <div className="text-[9px] text-dark-500 font-bold uppercase tracking-widest">Perp</div>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-center font-mono">
                  <span className="text-white font-medium">
                    {m.markPx > 100 ? m.markPx.toFixed(2) : m.markPx.toFixed(4)}
                  </span>
                </div>
                <div className="flex flex-col items-end justify-center font-mono">
                  <div className={clsx(
                    "flex items-center gap-0.5 font-bold",
                    m.change24h >= 0 ? "text-brand-neon" : "text-brand-red"
                  )}>
                    {m.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(m.change24h).toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
