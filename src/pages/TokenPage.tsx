import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ExternalLink, 
  Activity, 
  BarChart2, 
  Waves, 
  History,
  Info,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { fetchMarkets, HYPERLIQUID_WS_URL } from '../api/hyperliquid';
import { TradingChart } from '../components/chart/TradingChart';
import clsx from 'clsx';

interface Trade {
  side: 'B' | 'S';
  px: string;
  sz: string;
  time: number;
}

export const TokenPage: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: markets, isLoading: marketsLoading } = useQuery({
    queryKey: ['markets', 'Crypto'],
    queryFn: () => fetchMarkets('Crypto'),
    refetchInterval: 3000,
  });

  const stats = markets?.find(m => m.name === symbol);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  
  const whaleTrades = useStore(s => s.whaleTrades);
  const wallSnapshots = useStore(s => s.wallSnapshots) as Record<string, any>;
  
  // Filter global feeds for this specific token
  const tokenWhales = useMemo(() => 
    whaleTrades.filter(t => t.coin === symbol).slice(0, 10),
    [whaleTrades, symbol]
  );
  
  const tokenWall = wallSnapshots[symbol || ''];

  useEffect(() => {
    if (!symbol) return;

    // WS for live trades
    const ws = new WebSocket(HYPERLIQUID_WS_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: symbol } }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'trades' && msg.data) {
          setRecentTrades(prev => [...msg.data, ...prev].slice(0, 50));
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, [symbol]);

  if (marketsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-1000">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-neon border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-dark-500">Initializing Terminal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-1000 overflow-hidden">
      {useStore.getState().selectedCategory !== 'Crypto' && (
        <div className="bg-brand-red/10 border-b border-brand-red/20 px-4 py-1.5 flex items-center justify-center gap-2 z-30">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-red animate-pulse">
            ⚠️ Simulated Data — Institutional market proxy under maintenance
          </span>
        </div>
      )}
      
      {/* HEADER STATS */}
      <div className="h-20 shrink-0 border-b border-dark-900 bg-dark-1000/50 backdrop-blur-xl flex items-center px-6 justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-dark-900 rounded-xl text-dark-500 hover:text-white transition-all group"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center">
              <span className="text-xl font-black text-brand-neon tracking-tighter">{symbol?.slice(0, 1)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">{symbol}</h1>
                <span className="px-2 py-0.5 text-[9px] font-black bg-dark-800 text-dark-400 rounded uppercase">Perp</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono mt-0.5">
                <span className="text-dark-500">PRICE</span>
                <span className="text-white font-black">${stats?.markPx?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className={clsx("font-black", (stats?.change24h || 0) >= 0 ? "text-brand-neon" : "text-red-500")}>
                  {(stats?.change24h || 0) >= 0 ? '+' : ''}{stats?.change24h?.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          <div className="text-right">
            <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">24h Volume</div>
            <div className="text-sm font-black text-white tracking-tight">
              {stats?.volume24h && stats.volume24h >= 1e9 
                ? `$${(stats.volume24h / 1e9).toFixed(2)}B` 
                : stats?.volume24h 
                  ? `$${(stats.volume24h / 1e6).toFixed(2)}M` 
                  : '$0.00M'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Open Interest</div>
            <div className="text-sm font-black text-white tracking-tight">
              {stats?.openInterest && stats?.markPx && (stats.openInterest * stats.markPx) >= 1e6 
                ? `$${(stats.openInterest * stats.markPx / 1e6).toFixed(2)}M`
                : stats?.openInterest && stats?.markPx
                  ? `$${(stats.openInterest * stats.markPx / 1e3).toFixed(1)}K`
                  : '$0.0K'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1">Explorer</div>
            <a 
              href={`https://hypurrscan.io/market/${symbol}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-brand-neon hover:underline flex items-center gap-1 text-[11px] font-black uppercase tracking-widest"
            >
              Hypurrscan <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="flex-1 flex min-h-0">
        
        {/* LEFT PANEL: CHART & WALLS */}
        <div className="flex-[2.5] flex flex-col border-r border-dark-900 overflow-hidden">
          <div className="flex-1 border-b border-dark-900 relative">
            <TradingChart symbol={symbol || 'BTC'} />
          </div>
          
          <div className="h-[280px] shrink-0 flex">
            {/* RECENT TAPE PREVIEW */}
            <div className="flex-1 border-r border-dark-900 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-dark-900 bg-dark-950/50 flex justify-between items-center">
                <div className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-brand-neon" /> Recent Tape
                </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-dark-950/95 border-b border-dark-900 z-10">
                    <tr>
                      <th className="p-3 text-[9px] font-black uppercase text-dark-500">Price</th>
                      <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Size</th>
                      <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-900/30">
                    <AnimatePresence initial={false}>
                      {recentTrades.map((t, i) => (
                        <motion.tr 
                          key={`${t.time}-${i}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="hover:bg-dark-900/20"
                        >
                          <td className={clsx("p-3 font-mono text-[11px] font-black", t.side === 'B' ? "text-brand-neon" : "text-red-500")}>
                            {parseFloat(t.px).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono text-[11px] text-white">
                            {parseFloat(t.sz).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-[10px] text-dark-500 uppercase">
                            {new Date(t.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUCTION / INFO PANEL */}
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-dark-900 bg-dark-950/50">
                <div className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" /> Asset Info
                </div>
              </div>
              <div className="flex-1 p-4 space-y-4 overflow-auto custom-scrollbar">
                <div className="flex justify-between">
                  <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Initial Launch</span>
                  <span className="text-[10px] font-black text-white uppercase">Dutch Auction (HIP-1)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">Liquidity Type</span>
                  <span className="text-[10px] font-black text-white uppercase">L1 Native Perp</span>
                </div>
                <div className="p-3 rounded-xl bg-brand-neon/5 border border-brand-neon/10">
                  <div className="flex items-center gap-2 text-[10px] font-black text-brand-neon uppercase tracking-widest mb-1">
                    <Info className="w-3 h-3" /> Intelligence Note
                  </div>
                  <p className="text-[10px] text-dark-400 leading-relaxed italic">
                    This asset was deployed directly on the Hyperliquid L1. All trades are settled on-chain with sub-second finality.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: LIVE TRADES & WHALES */}
        <div className="w-[400px] shrink-0 flex flex-col overflow-hidden bg-dark-1000/30">
          
          {/* ORDER WALLS */}
          <div className="flex-1 flex flex-col border-b border-dark-900 overflow-hidden">
            <div className="p-3 border-b border-dark-900 bg-dark-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-[10px] font-black text-white uppercase tracking-widest">Order Depth</div>
              </div>
              <Link to="/walls" className="text-[9px] font-black text-brand-neon hover:underline uppercase tracking-widest">Full View</Link>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col justify-center items-center bg-dark-1000/20">
              {tokenWall ? (
                 <div className="w-full space-y-4">
                    <div className="flex items-end gap-1 h-32">
                       {/* Real visual representation of walls */}
                       {tokenWall.asks.slice(0, 10).reverse().map((bin: any, i: number) => (
                         <div 
                           key={`ask-${i}`} 
                           className="flex-1 bg-red-500/20 rounded-t-sm transition-all duration-500"
                           style={{ height: `${Math.min(100, (bin.usdValue / (tokenWall.totalAskUsd || 1)) * 300 + 5)}%` }}
                         />
                       ))}
                       {tokenWall.bids.slice(0, 10).map((bin: any, i: number) => (
                         <div 
                           key={`bid-${i}`} 
                           className="flex-1 bg-brand-neon/20 rounded-t-sm transition-all duration-500"
                           style={{ height: `${Math.min(100, (bin.usdValue / (tokenWall.totalBidUsd || 1)) * 300 + 5)}%` }}
                         />
                       ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-black px-2">
                      <div className="flex flex-col">
                        <span className="text-dark-500 uppercase text-[8px]">Asks</span>
                        <span className="text-red-500">${(tokenWall.totalAskUsd / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-dark-500 uppercase text-[8px]">Bids</span>
                        <span className="text-brand-neon">${(tokenWall.totalBidUsd / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                 </div>
              ) : (
                <div className="text-center opacity-30 flex flex-col items-center">
                  <Activity className="w-6 h-6 mb-2 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Syncing Depth...</span>
                </div>
              )}
            </div>
          </div>

          {/* TOKEN WHALES */}
          <div className="h-[300px] shrink-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-dark-900 bg-dark-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-[10px] font-black text-white uppercase tracking-widest">Asset Whales</div>
              </div>
              <Link to="/track" className="text-[9px] font-black text-blue-400 hover:underline uppercase tracking-widest">Radar</Link>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {tokenWhales.map(t => (
                  <motion.div 
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-dark-900/50 border border-dark-800 flex justify-between items-center"
                  >
                    <div>
                      <div className={clsx("text-[10px] font-black uppercase tracking-widest", t.side === 'B' ? "text-brand-neon" : "text-red-500")}>
                        {t.side === 'B' ? 'WHALE BUY' : 'WHALE SELL'}
                      </div>
                      <div className="text-[9px] font-mono text-dark-500 mt-0.5">{t.user.slice(0, 8)}...</div>
                    </div>
                    <div className="text-right font-black text-white text-[12px]">
                      ${(t.usdValue / 1000).toFixed(0)}K
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tokenWhales.length === 0 && (
                <div className="py-12 text-center opacity-20 flex flex-col items-center">
                  <Waves className="w-8 h-8 mb-2" />
                  <span className="text-[9px] font-black uppercase tracking-widest">No Recent Whales</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
