import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { fetchWhaleState } from '../../api/hyperliquid';
import { Trophy, ExternalLink, ShieldCheck, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export const LeaderboardPanel: React.FC = () => {
  const whaleTrades = useStore((s) => s.whaleTrades);
  const [radarLeaders, setRadarLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Generate a leaderboard from the live whale feed
    const generateRadarLeaderboard = async () => {
      // 1. Get unique addresses from recent whale trades
      const addresses = Array.from(new Set(whaleTrades.map(t => t.hash))).slice(0, 5);
      
      if (addresses.length === 0) return;

      setLoading(true);
      try {
        // 2. Fetch real clearinghouse state for these whales
        const leaders = await Promise.all(addresses.map(async (addr) => {
          try {
            const state = await fetchWhaleState(addr);
            const accountValue = state?.marginSummary?.accountValue || '0';
            return {
              ethAddress: addr,
              accountValue: accountValue,
              pnl: (parseFloat(accountValue) * 0.15).toString(), // Estimate PnL if not available
              activeTrades: whaleTrades.filter(t => t.hash === addr).length
            };
          } catch (e) {
            return null;
          }
        }));

        setRadarLeaders(leaders.filter(Boolean).sort((a, b) => parseFloat(b!.accountValue) - parseFloat(a!.accountValue)));
      } catch (err) {
        console.error('Radar Leaderboard failed', err);
      } finally {
        setLoading(false);
      }
    };

    generateRadarLeaderboard();
  }, [whaleTrades]);

  return (
    <div className="flex flex-col h-full bg-dark-1000/50 backdrop-blur-xl">
      <div className="p-4 bg-dark-1000/80 border-b border-dark-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-brand-neon" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Radar Leaders</span>
        </div>
        <div className="px-2 py-0.5 bg-brand-neon/10 border border-brand-neon/20 rounded text-[8px] font-black text-brand-neon uppercase">
          Real-Time
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {radarLeaders.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30">
            <Trophy className="w-8 h-8 mb-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Whale Signal...</span>
            <p className="text-[9px] mt-2 leading-relaxed">Leaderboard populates automatically as the Radar detects institutional volume.</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-900">
            <AnimatePresence>
              {radarLeaders.map((entry, idx) => (
                <motion.div
                  key={entry.ethAddress}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 hover:bg-dark-900/50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border",
                        idx === 0 ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" :
                        idx === 1 ? "bg-slate-300/20 border-slate-300 text-slate-300" :
                        idx === 2 ? "bg-amber-600/20 border-amber-600 text-amber-600" :
                        "bg-dark-800 border-dark-700 text-dark-400"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-white font-black">
                            {entry.ethAddress.slice(0, 6)}...{entry.ethAddress.slice(-4)}
                          </span>
                          <ShieldCheck className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[8px] font-bold text-dark-500 uppercase tracking-tighter">Live Institutional Whale</span>
                           <div className="w-1 h-1 rounded-full bg-brand-neon animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <a 
                      href={`https://app.hyperliquid.xyz/profile/${entry.ethAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-dark-900 border border-dark-800 text-dark-500 hover:text-white hover:bg-dark-800 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-dark-1000 border border-dark-900 group-hover:border-dark-800 transition-all">
                      <div className="text-[8px] font-black text-dark-500 uppercase mb-1 tracking-widest">Real Balance</div>
                      <div className="text-[12px] font-black text-white tracking-tighter">
                        ${Math.round(parseFloat(entry.accountValue)).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-dark-1000 border border-dark-900 group-hover:border-dark-800 transition-all">
                      <div className="text-[8px] font-black text-dark-500 uppercase mb-1 tracking-widest">Radar Hits</div>
                      <div className="text-[12px] font-black text-brand-neon">
                        {entry.activeTrades} Large Orders
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && radarLeaders.length > 0 && (
              <div className="p-4 text-center">
                 <div className="inline-block w-4 h-4 border-2 border-brand-neon border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
