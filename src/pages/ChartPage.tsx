import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { fetchMarkets } from '../api/hyperliquid';
import { TradingChart } from '../components/chart/TradingChart';
import { Watchlist } from '../components/markets/Watchlist';
import { DrawingToolbar } from '../components/chart/DrawingToolbar';
import { Activity } from 'lucide-react';
import clsx from 'clsx';

export const ChartPage = () => {
  const selectedMarket = useStore((s) => s.selectedMarket);

  const { data: markets } = useQuery({
    queryKey: ['markets'],
    queryFn: () => fetchMarkets(),
    refetchInterval: 5000,
  });

  const market = Array.isArray(markets) ? markets.find((m) => m.name === selectedMarket) : undefined;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-dark-1000">
      {/* LEFT: Main Chart Area Wrapper (Row for Sidebar + Chart Content) */}
      <div className="flex-1 relative flex flex-row min-w-0 border-r border-dark-900">
        <DrawingToolbar />
        
        {/* CHART CONTENT WRAPPER (Column for Overlay, Toolbar, and Chart) */}
        <div className="flex-1 relative flex flex-col min-w-0">
          
          {/* CHART OVERLAY: Top Left Info */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <div className="bg-dark-950/90 backdrop-blur-md border border-dark-800/80 p-3 rounded-xl shadow-2xl flex items-center gap-4 min-w-[200px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tighter text-white">{selectedMarket}USD</span>
                  <span className="bg-brand-neon/10 text-brand-neon text-[10px] px-1.5 py-0.5 rounded font-bold border border-brand-neon/20">PERP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold text-white leading-tight">
                    {market?.markPx.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={clsx("text-xs font-bold", (market?.change24h || 0) >= 0 ? "text-brand-neon" : "text-brand-red")}>
                    {(market?.change24h || 0) >= 0 ? '+' : ''}{market?.change24h?.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TOOLBAR: Top Center/Right */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-dark-950/80 border border-dark-800 p-1.5 rounded-lg">
            {['1m', '5m', '15m', '1h', '4h', '1D'].map(tf => (
              <button key={tf} className="px-2 py-1 text-[10px] font-bold text-dark-400 hover:text-white transition-colors">{tf}</button>
            ))}
            <div className="w-px h-3 bg-dark-800 mx-1" />
            <Activity size={14} className="text-dark-400 hover:text-brand-neon cursor-pointer" />
          </div>

          {/* MAIN CHART */}
          <div className="flex-1 min-h-0 bg-dark-1000 overflow-hidden">
            <TradingChart key={selectedMarket} symbol={selectedMarket} />
          </div>
        </div>
      </div>

      {/* RIGHT: Watchlist Sidebar */}
      <div className="w-[320px] flex flex-col shrink-0">
        <Watchlist />
      </div>
    </div>
  );
};
