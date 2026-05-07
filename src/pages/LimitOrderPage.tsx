import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Copy, 
  Bell, 
  Search, 
  ArrowUpDown,
  Target,
  Zap,
  Activity,
  ShieldAlert,
  ExternalLink
} from 'lucide-react';
import { useStore } from '../store';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RADAR_COINS = ["BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "DOGE", "SUI", "TIA", "OP"];
const WALL_THRESHOLD = 100000; // $100k Wall

export const LimitOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const limitOrders = useStore((s) => s.limitOrders);
  const addLimitOrder = useStore((s) => s.addLimitOrder);
  
  const [filter, setFilter] = useState('');
  const [sideFilter, setSideFilter] = useState<'All' | 'Buy' | 'Sell'>('All');
  const [sortBy, setSortBy] = useState<'usdValue' | 'timestamp'>('usdValue');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(HL_WS_URL);
      
      ws.current.onopen = () => {
        RADAR_COINS.forEach(coin => {
          ws.current?.send(JSON.stringify({
            method: "subscribe",
            subscription: { type: "l2Book", coin }
          }));
        });
      };

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'l2Book' && msg.data) {
          const book = msg.data;
          const coin = book.coin;
          const timestamp = book.time;

          // Process Bids (Buy Orders)
          book.levels[0].forEach((level: any) => {
            const usdValue = parseFloat(level.px) * parseFloat(level.sz);
            if (usdValue >= WALL_THRESHOLD) {
              addLimitOrder({
                coin,
                side: 'Buy',
                px: level.px,
                sz: level.sz,
                usdValue,
                timestamp
              });
            }
          });

          // Process Asks (Sell Orders)
          book.levels[1].forEach((level: any) => {
            const usdValue = parseFloat(level.px) * parseFloat(level.sz);
            if (usdValue >= WALL_THRESHOLD) {
              addLimitOrder({
                coin,
                side: 'Sell',
                px: level.px,
                sz: level.sz,
                usdValue,
                timestamp
              });
            }
          });
        }
      };

      ws.current.onclose = () => setTimeout(connect, 3000);
    };

    connect();
    return () => ws.current?.close();
  }, [addLimitOrder]);

  const filteredOrders = useMemo(() => {
    return limitOrders
      .filter(o => {
        const matchesSearch = o.coin.toLowerCase().includes(filter.toLowerCase());
        const matchesSide = sideFilter === 'All' || o.side === sideFilter;
        return matchesSearch && matchesSide;
      })
      .sort((a, b) => {
        if (sortBy === 'usdValue') return b.usdValue - a.usdValue;
        return b.timestamp - a.timestamp;
      });
  }, [limitOrders, filter, sideFilter, sortBy]);

  const totalValue = useMemo(() => limitOrders.reduce((acc, o) => acc + o.usdValue, 0), [limitOrders]);
  const mostActive = useMemo(() => {
    const counts: Record<string, number> = {};
    limitOrders.forEach(o => counts[o.coin] = (counts[o.coin] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  }, [limitOrders]);

  return (
    <div className="flex flex-col h-full bg-dark-1000 p-6 overflow-hidden">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Order Walls</h1>
          <p className="text-dark-500 text-xs font-mono mt-1">Large unfilled limit orders (&gt; $100K) streaming live from Hyperliquid order books</p>
        </div>
        <a
          href="https://app.hyperliquid.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-dark-950 border border-brand-neon/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-neon hover:bg-brand-neon/10 transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
          Live: Hyperliquid L1 On-Chain
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="p-6 rounded-2xl bg-dark-950 border border-dark-800 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-brand-neon" /> Total Walls Detected
          </div>
          <div className="text-3xl font-black text-white tracking-tighter">{limitOrders.length}</div>
        </div>
        <div className="p-6 rounded-2xl bg-dark-950 border border-dark-800 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-500" /> Total Value Locked
          </div>
          <div className="text-3xl font-black text-white tracking-tighter">
            ${(totalValue / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-dark-950 border border-dark-800 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> High Activity Focus
          </div>
          <div className="text-3xl font-black text-white tracking-tighter uppercase">{mostActive}</div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-dark-950 border border-dark-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input 
            type="text"
            placeholder="Filter by token (e.g. BTC)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-dark-1000 border border-dark-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-brand-neon transition-all outline-none"
          />
        </div>
        
        <div className="flex bg-dark-1000 rounded-xl p-1 border border-dark-800">
          {['All', 'Buy', 'Sell'].map((s) => (
            <button
              key={s}
              onClick={() => setSideFilter(s as any)}
              className={clsx(
                "px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                sideFilter === s ? "bg-dark-800 text-white" : "text-dark-500 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <button 
          onClick={() => setSortBy(sortBy === 'usdValue' ? 'timestamp' : 'usdValue')}
          className="flex items-center gap-2 px-4 py-2.5 bg-dark-1000 border border-dark-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-dark-400 hover:text-white transition-all"
        >
          <ArrowUpDown className="w-3.5 h-3.5" /> 
          Sort: {sortBy === 'usdValue' ? 'Value' : 'Recent'}
        </button>
      </div>

      {/* TABLE */}
      <div className="flex-1 bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-dark-900 z-10">
              <tr className="border-b border-dark-800">
                <th className="p-4 text-[9px] font-black uppercase text-dark-500">Market</th>
                <th className="p-4 text-[9px] font-black uppercase text-dark-500">Side</th>
                <th className="p-4 text-[9px] font-black uppercase text-dark-500 text-right">Price</th>
                <th className="p-4 text-[9px] font-black uppercase text-dark-500 text-right">Size</th>
                <th className="p-4 text-[9px] font-black uppercase text-dark-500 text-right">Est. Value</th>
                <th className="p-4 text-[9px] font-black uppercase text-dark-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filteredOrders.map((order, idx) => (
                  <motion.tr 
                    key={`${order.coin}-${order.px}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="border-b border-dark-900/50 hover:bg-dark-900/30 transition-all group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center font-black text-xs text-white">
                          {order.coin[0]}
                        </div>
                        <span className="text-sm font-black text-white">{order.coin}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                        order.side === 'Buy' ? "bg-brand-neon/10 text-brand-neon" : "bg-red-500/10 text-red-500"
                      )}>
                        {order.side}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-mono text-white">${parseFloat(order.px).toLocaleString()}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-mono text-dark-400">{parseFloat(order.sz).toFixed(2)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-black text-white">${Math.round(order.usdValue).toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => navigate(`/chart?coin=${order.coin}`)}
                          className="p-2 bg-dark-800 hover:bg-brand-neon hover:text-dark-1000 rounded-lg transition-all"
                          title="View Chart"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <a 
                          href={`https://app.hyperliquid.xyz/trade/${order.coin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-dark-800 hover:bg-blue-500 rounded-lg transition-all"
                          title="Copy Trade"
                        >
                          <Copy className="w-4 h-4" />
                        </a>
                        <button 
                          onClick={() => alert(`Alert set for ${order.coin} at $${order.px}`)}
                          className="p-2 bg-dark-800 hover:bg-yellow-500 rounded-lg transition-all"
                          title="Set Alert"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                        <a 
                          href={`https://app.hyperliquid.xyz/explorer/coin/${order.coin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-dark-800 hover:bg-purple-500 rounded-lg transition-all"
                          title="Verify On-Chain"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-dark-600">
               <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
               <p className="text-sm font-bold uppercase tracking-widest">No order walls detected in selected range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
