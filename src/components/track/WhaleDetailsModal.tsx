import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import type { WhalePosition } from '../../store';
import { fetchWhaleState } from '../../api/hyperliquid';
import { X, Briefcase, TrendingUp, TrendingDown, DollarSign, ExternalLink, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export const WhaleDetailsModal: React.FC = () => {
  const { selectedWhale, setSelectedWhale } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedWhale?.address) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchWhaleState(selectedWhale.address);
        if (data) {
          const positions = (data.assetPositions || []).map((p: any) => {
            const pos = p.position;
            return {
              coin: pos.coin,
              size: pos.szi,
              entryPrice: pos.entryPx,
              unrealizedPnl: pos.unrealizedPnl,
              side: parseFloat(pos.szi) >= 0 ? 'Long' : 'Short'
            };
          });

          setSelectedWhale({
            address: selectedWhale.address,
            totalValue: data.marginSummary?.accountValue || '0',
            withdrawable: data.marginSummary?.withdrawable || '0',
            positions: positions
          });
        }
      } catch (err) {
        console.error('Whale state fetch failed', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedWhale?.address, setSelectedWhale]);

  if (!selectedWhale) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark-1000/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        {/* HEADER */}
        <div className="p-6 bg-dark-900/50 border-b border-dark-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand-neon" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight uppercase">Whale Intelligence</h2>
              <p className="text-[10px] font-mono text-dark-500">{selectedWhale.address}</p>
            </div>
          </div>
          <button 
            onClick={() => setSelectedWhale(null)}
            className="p-2 hover:bg-dark-800 rounded-lg text-dark-500 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {loading && selectedWhale.positions.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-brand-neon border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-500">Querying Clearinghouse...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* STATS GRID */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-dark-900/30 border border-dark-800">
                  <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" /> Account Value
                  </div>
                  <div className="text-2xl font-black text-white tracking-tighter">
                    ${parseFloat(selectedWhale.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-dark-900/30 border border-dark-800">
                  <div className="text-[9px] font-black text-dark-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" /> Buying Power
                  </div>
                  <div className="text-2xl font-black text-white tracking-tighter">
                    ${parseFloat(selectedWhale.withdrawable).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* POSITIONS TABLE */}
              <div className="flex flex-col">
                <div className="text-[10px] font-black uppercase tracking-widest text-dark-500 mb-3 px-1">Active Positions ({selectedWhale.positions.length})</div>
                <div className="border border-dark-800 rounded-xl overflow-hidden bg-dark-1000/30">
                  <table className="w-full text-left">
                    <thead className="bg-dark-900/50 border-b border-dark-800">
                      <tr>
                        <th className="p-3 text-[9px] font-black uppercase text-dark-500">Asset</th>
                        <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-center">Side</th>
                        <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Size</th>
                        <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Entry</th>
                        <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Unrealized PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {selectedWhale.positions.map((pos: WhalePosition, idx: number) => (
                        <tr key={idx} className="hover:bg-dark-900/30 transition-all">
                          <td className="p-3">
                            <span className="text-[11px] font-black text-white">{pos.coin}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-center">
                              <span className={clsx(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                pos.side === 'Long' ? "bg-brand-neon/10 text-brand-neon" : "bg-red-500/10 text-red-500"
                              )}>
                                {pos.side}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-[11px] font-mono text-white">{parseFloat(pos.size).toFixed(3)}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-[11px] font-mono text-dark-400">${parseFloat(pos.entryPrice).toLocaleString()}</span>
                          </td>
                          <td className="p-3 text-right">
                            <div className={clsx(
                              "text-[11px] font-black flex items-center justify-end gap-1",
                              parseFloat(pos.unrealizedPnl) >= 0 ? "text-brand-neon" : "text-red-500"
                            )}>
                              {parseFloat(pos.unrealizedPnl) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              ${Math.abs(parseFloat(pos.unrealizedPnl)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedWhale.positions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-10 text-center">
                            <span className="text-[10px] font-bold text-dark-500 uppercase tracking-widest">No active positions</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <a 
                  href={`https://app.hyperliquid.xyz/profile/${selectedWhale.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-brand-neon text-dark-1000 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,163,0.3)]"
                >
                  View Full Profile <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
