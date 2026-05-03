import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { fetchLeaderboard } from '../../api/hyperliquid';
import { Trophy, TrendingUp, User, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export const LeaderboardPanel: React.FC = () => {
  const { leaderboard, setLeaderboard } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLeaderboard();
        if (data && data.leaderboardEntries) {
          // Hyperliquid returns a list of entries
          const mapped = data.leaderboardEntries.slice(0, 10).map((entry: any, index: number) => ({
            ethAddress: entry.ethAddress,
            accountValue: entry.accountValue,
            pnl: entry.pnl,
            winRate: entry.winRate || 0,
            rank: index + 1
          }));
          setLeaderboard(mapped);
        }
      } catch (err) {
        console.error('Leaderboard fetch failed', err);
      } finally {
        setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 30000); // Update every 30s
    return () => clearInterval(timer);
  }, [setLeaderboard]);

  return (
    <div className="flex flex-col h-full bg-dark-1000/50 backdrop-blur-xl">
      <div className="p-4 bg-dark-1000/80 border-b border-dark-900 flex items-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Smart Money Leaderboard</span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && leaderboard.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-2 border-brand-neon border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-dark-500">Indexing Top Traders...</span>
          </div>
        ) : (
          <div className="divide-y divide-dark-900">
            <AnimatePresence>
              {leaderboard.map((entry, idx) => (
                <motion.div
                  key={entry.ethAddress}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 hover:bg-dark-900/50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-6 h-6 rounded flex items-center justify-center text-[10px] font-black",
                        idx === 0 ? "bg-yellow-500 text-dark-1000" :
                        idx === 1 ? "bg-slate-300 text-dark-1000" :
                        idx === 2 ? "bg-amber-600 text-dark-1000" :
                        "bg-dark-800 text-dark-400"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-white">
                            {entry.ethAddress.slice(0, 6)}...{entry.ethAddress.slice(-4)}
                          </span>
                          <ShieldCheck className="w-3 h-3 text-brand-neon" />
                        </div>
                        <span className="text-[9px] font-bold text-dark-500 uppercase tracking-tighter">Verified PnL</span>
                      </div>
                    </div>
                    <a 
                      href={`https://app.hyperliquid.xyz/profile/${entry.ethAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-dark-800 text-dark-500 hover:text-white hover:bg-dark-700 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-2 rounded bg-dark-900/30">
                      <div className="text-[8px] font-black text-dark-500 uppercase mb-1">Account Value</div>
                      <div className="text-[11px] font-black text-white">
                        ${parseFloat(entry.accountValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-dark-900/30">
                      <div className="text-[8px] font-black text-dark-500 uppercase mb-1">All-Time PnL</div>
                      <div className={clsx(
                        "text-[11px] font-black",
                        parseFloat(entry.pnl) >= 0 ? "text-brand-neon" : "text-red-500"
                      )}>
                        ${parseFloat(entry.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
