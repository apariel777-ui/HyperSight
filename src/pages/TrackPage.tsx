import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  TrendingUp, 
  ShieldCheck,
  MousePointer2,
  Waves,
  Skull,
  Flame
} from 'lucide-react';
import { useStore } from '../store';
import clsx from 'clsx';

const WHALE_THRESHOLD = 5000;
const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';

const RADAR_COINS = ["BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "DOGE", "SUI", "TIA", "OP"];

const SMART_MONEY_WALLETS = [
  '0x6431945a6669b2d863f68ef8e747372b0c363b9f',
  '0x8623b976269661a29f8c5b169f9e71b26938a9a6',
];

export const TrackPage: React.FC = () => {
  const whaleTrades = useStore((s) => s.whaleTrades);
  const addWhaleTrade = useStore((s) => s.addWhaleTrade);
  const liquidations = useStore((s) => s.liquidations);
  const addLiquidation = useStore((s) => s.addLiquidation);
  const tgUsername = useStore((s) => s.tgUsername);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  const handleSetAlert = async (walletAddress: string) => {
    if (!tgUsername) {
      alert("Please set your Telegram username in the Auctions tab first!");
      return;
    }

    try {
      const res = await fetch('/api/alerts/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tgUsername, walletAddress })
      });
      if (res.ok) {
        alert(`🚨 Tracking enabled for ${walletAddress.slice(0,6)}...`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalVolume = whaleTrades.reduce((acc, t) => acc + t.usdValue, 0);
  const buyCount = whaleTrades.filter(t => t.side === 'B').length;
  const sellCount = whaleTrades.filter(t => t.side === 'S').length;

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(HL_WS_URL);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        RADAR_COINS.forEach(coin => {
          ws.current?.send(JSON.stringify({
            method: "subscribe",
            subscription: { type: "trades", coin }
          }));
          ws.current?.send(JSON.stringify({
            method: "subscribe",
            subscription: { type: "liquidations", coin }
          }));
        });
      };

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.channel === 'trades' && msg.data) {
          msg.data.forEach((trade: any) => {
            const usdValue = parseFloat(trade.px) * parseFloat(trade.sz);
            if (usdValue >= WHALE_THRESHOLD) {
              addWhaleTrade({
                id: `${trade.hash}-${trade.time}`,
                coin: trade.coin,
                side: trade.side,
                px: trade.px,
                sz: trade.sz,
                time: trade.time,
                hash: trade.hash,
                usdValue: usdValue,
                isSmartMoney: SMART_MONEY_WALLETS.includes(trade.hash.toLowerCase())
              });
            }
          });
        }

        if (msg.channel === 'liquidations' && msg.data) {
          // Hyperliquid liquidations channel sends single events or arrays
          const liqs = Array.isArray(msg.data) ? msg.data : [msg.data];
          liqs.forEach((liq: any) => {
             addLiquidation({
               id: `${liq.coin}-${Date.now()}-${Math.random()}`,
               coin: liq.coin,
               side: liq.side === 'B' ? 'Short' : 'Long',
               px: liq.px,
               sz: liq.sz,
               time: Date.now(),
               usdValue: parseFloat(liq.px) * parseFloat(liq.sz)
             });
          });
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => ws.current?.close();
  }, []);

  return (
    <div className="flex flex-col h-full bg-dark-1000">
      {/* HEADER STATS */}
      <div className="grid grid-cols-4 border-b border-dark-900 bg-dark-1000/50 backdrop-blur-xl">
        <div className="p-6 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[10px] font-black uppercase tracking-widest mb-1">
            <Waves className="w-3.5 h-3.5 text-blue-400" />
            Whale Activity
          </div>
          <div className="text-2xl font-black text-white tracking-tighter">
            ${(totalVolume / 1000000).toFixed(2)}M
          </div>
        </div>
        
        <div className="p-6 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[10px] font-black uppercase tracking-widest mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-brand-neon" />
            Buy/Sell Ratio
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black text-brand-neon tracking-tighter">{buyCount}</div>
            <div className="h-6 w-[1px] bg-dark-800" />
            <div className="text-2xl font-black text-red-500 tracking-tighter">{sellCount}</div>
          </div>
        </div>

        <div className="p-6 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[10px] font-black uppercase tracking-widest mb-1">
            <Skull className="w-3.5 h-3.5 text-red-500" />
            Liquidations
          </div>
          <div className="text-2xl font-black text-white tracking-tighter">
            {liquidations.length}
          </div>
        </div>

        <div className="p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className={clsx(
              "w-2 h-2 rounded-full animate-pulse",
              isConnected ? "bg-brand-neon shadow-[0_0_10px_#00ffa3]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"
            )} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {isConnected ? "Radar Live" : "Reconnecting"}
            </span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN FEED */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* WHALE RADAR COLUMN */}
        <div className="flex-1 flex flex-col border-r border-dark-900 overflow-hidden">
          <div className="p-4 bg-dark-1000/80 border-b border-dark-900 flex justify-between items-center">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
               <Waves className="w-3.5 h-3.5 text-blue-400" />
               Whale Feed
             </div>
             <span className="text-[9px] text-dark-500 font-bold uppercase">Real-time trades</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-dark-1000/95 backdrop-blur-md z-10">
                <tr className="border-b border-dark-900">
                  <th className="p-4 text-[9px] font-black uppercase tracking-widest text-dark-500">Player</th>
                  <th className="p-4 text-[9px] font-black uppercase tracking-widest text-dark-500">Market</th>
                  <th className="p-4 text-[9px] font-black uppercase tracking-widest text-dark-500 text-center">Side</th>
                  <th className="p-4 text-[9px] font-black uppercase tracking-widest text-dark-500 text-right">Value</th>
                  <th className="p-4 text-[9px] font-black uppercase tracking-widest text-dark-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {whaleTrades.map((trade) => (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="border-b border-dark-900 group hover:bg-dark-900/50 transition-all"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={clsx(
                            "w-6 h-6 rounded flex items-center justify-center border",
                            trade.isSmartMoney ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-dark-800 border-dark-700 text-dark-400"
                          )}>
                            {trade.isSmartMoney ? <ShieldCheck className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3 opacity-50" />}
                          </div>
                          <span className="text-[10px] font-mono text-white">{trade.hash.slice(0, 6)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-black text-white">{trade.coin}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                            trade.side === 'B' ? "bg-brand-neon/10 text-brand-neon" : "bg-red-500/10 text-red-500"
                          )}>
                            {trade.side === 'B' ? 'Long' : 'Short'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-[11px] font-black text-white">${trade.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleSetAlert(trade.hash)} className="p-1.5 bg-dark-800 hover:bg-brand-neon hover:text-dark-1000 rounded transition-all">
                            <Bell className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* LIQUIDATION FEED COLUMN */}
        <div className="w-[450px] flex flex-col overflow-hidden bg-dark-1000/30">
          <div className="p-4 bg-dark-1000/80 border-b border-dark-900 flex justify-between items-center">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
               <Skull className="w-3.5 h-3.5 text-red-500" />
               Liquidation Feed
             </div>
             <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span className="text-[9px] text-orange-500 font-bold uppercase">Heatmap Active</span>
             </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
             <div className="p-4 space-y-3">
               <AnimatePresence initial={false}>
                 {liquidations.map(liq => (
                   <motion.div
                     key={liq.id}
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     className={clsx(
                       "relative p-4 rounded-xl border overflow-hidden group",
                       liq.side === 'Long' ? "bg-red-500/5 border-red-500/20" : "bg-brand-neon/5 border-brand-neon/20"
                     )}
                   >
                     <motion.div 
                        initial={{ opacity: 0.5 }} 
                        animate={{ opacity: 0 }} 
                        transition={{ duration: 1 }}
                        className={clsx("absolute inset-0 z-0", liq.side === 'Long' ? "bg-red-500" : "bg-brand-neon")} 
                     />
                     
                     <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-black text-white tracking-tighter">{liq.coin}</span>
                            <span className={clsx(
                              "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                              liq.side === 'Long' ? "bg-red-500/20 text-red-500" : "bg-brand-neon/20 text-brand-neon"
                            )}>
                              {liq.side === 'Long' ? '💀 Long Rekt' : '🔥 Short Squeeze'}
                            </span>
                          </div>
                          <div className="text-[10px] text-dark-500 font-mono">
                            At ${parseFloat(liq.px).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[14px] font-black text-white tracking-tighter">
                            ${liq.usdValue.toLocaleString()}
                          </div>
                        </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
               {liquidations.length === 0 && (
                 <div className="py-20 text-center opacity-30">
                    <Skull className="w-8 h-8 mx-auto mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Waiting for forced exits...</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
