import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell,
  TrendingUp,
  Waves,
  Skull
} from 'lucide-react';
import { useStore } from '../store';
import clsx from 'clsx';
import { LeaderboardPanel } from '../components/track/LeaderboardPanel';
import { WhaleDetailsModal } from '../components/track/WhaleDetailsModal';

const WHALE_THRESHOLD = 60000;
const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RADAR_COINS = ["BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "DOGE", "SUI", "TIA", "OP"];
const SMART_MONEY_WALLETS = [
  '0x6431945a6669b2d863f68ef8e747372b0c363b9f',
  '0x8623b976269661a29f8c5b169f9e71b26938a9a6',
];

// --- Module-level singletons (survive tab switches) ---
let _ws: WebSocket | null = null;
let _processedHashes = new Set<string>();
let _isInitialized = false;

function startRadarFeed() {
  if (_isInitialized) return;
  _isInitialized = true;

  const connect = () => {
    _ws = new WebSocket(HL_WS_URL);
    _ws.onopen = () => {
      RADAR_COINS.forEach(coin => {
        _ws?.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin } }));
        _ws?.send(JSON.stringify({ method: "subscribe", subscription: { type: "liquidations", coin } }));
      });
    };

    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'trades' && msg.data) {
          msg.data.forEach((trade: any) => {
            if (_processedHashes.has(trade.hash)) return;
            _processedHashes.add(trade.hash);
            if (_processedHashes.size > 5000) _processedHashes.clear();

            const usdValue = parseFloat(trade.px) * parseFloat(trade.sz);
            if (usdValue >= WHALE_THRESHOLD) {
              // HL WS trades have users[0] as the active address
              const walletAddress = trade.users ? trade.users[0] : trade.hash; 
              
              useStore.getState().addWhaleTrade({
                id: `${trade.hash}-${trade.time}`,
                coin: trade.coin,
                side: trade.side,
                px: trade.px,
                sz: trade.sz,
                time: trade.time,
                hash: trade.hash, // Actual transaction hash
                address: walletAddress,
                usdValue: usdValue,
                isSmartMoney: SMART_MONEY_WALLETS.includes(walletAddress.toLowerCase())
              });
            }
          });
        }

        if (msg.channel === 'liquidations' && msg.data) {
          const liq = msg.data;
          useStore.getState().addLiquidation({
            id: Math.random().toString(36).substr(2, 9),
            coin: liq.coin,
            side: liq.side === 'B' ? 'Short' : 'Long', 
            px: liq.px,
            sz: liq.sz,
            time: Date.now(),
            usdValue: Math.round(parseFloat(liq.px) * parseFloat(liq.sz)),
            user: liq.liquidated_user
          });
        }
      } catch (e) { /* ignore */ }
    };

    _ws.onclose = () => {
      setTimeout(connect, 3000);
    };
  };

  connect();
}
// ------------------------------------------------------

export const TrackPage: React.FC = () => {
  const whaleTrades = useStore((s) => s.whaleTrades);
  const liquidations = useStore((s) => s.liquidations);
  const tgUsername = useStore((s) => s.tgUsername);

  useEffect(() => {
    startRadarFeed();
  }, []);

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
      if (res.ok) alert(`🚨 Tracking enabled for ${walletAddress.slice(0,6)}...`);
    } catch (err) { console.error(err); }
  };

  const totalVolume = whaleTrades.reduce((acc, t) => acc + t.usdValue, 0);
  const buyVolume = whaleTrades.filter(t => t.side?.toUpperCase().startsWith('B')).reduce((acc, t) => acc + t.usdValue, 0);
  const buyPercent = totalVolume > 0 ? Math.round((buyVolume / totalVolume) * 100) : 50;
  const sellPercent = totalVolume > 0 ? 100 - buyPercent : 50;

  return (
    <div className="flex flex-col h-full bg-dark-1000 overflow-hidden">
      {/* HEADER STATS */}
      <div className="grid grid-cols-4 border-b border-dark-900 bg-dark-1000/50 backdrop-blur-xl shrink-0">
        <div className="p-4 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[9px] font-black uppercase tracking-widest mb-1">
            <Waves className="w-3.5 h-3.5 text-blue-400" /> Whale Activity
          </div>
          <div className="text-xl font-black text-white tracking-tighter">${(totalVolume / 1000000).toFixed(2)}M</div>
        </div>
        <div className="p-4 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[9px] font-black uppercase tracking-widest mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-brand-neon" /> Buy/Sell Ratio
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-brand-neon">{buyPercent}%</span>
            <div className="h-4 w-[1px] bg-dark-800" />
            <span className="text-lg font-black text-red-500">{sellPercent}%</span>
          </div>
        </div>
        <div className="p-4 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[9px] font-black uppercase tracking-widest mb-1">
            <Skull className="w-3.5 h-3.5 text-red-500" /> Liquidations
          </div>
          <div className="text-xl font-black text-white tracking-tighter">{liquidations.length}</div>
        </div>
        <div className="p-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse shadow-[0_0_10px_#00ffa3]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Radar Live</span>
        </div>
      </div>

      {/* THREE COLUMN TERMINAL */}
      <div className="flex-1 flex min-h-0">
        {/* WHALE FEED */}
        <div className="flex-[1.5] flex flex-col border-r border-dark-900 overflow-hidden">
          <div className="p-3 bg-dark-950/80 border-b border-dark-900 flex justify-between items-center shrink-0">
             <div className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
               <Waves className="w-3.5 h-3.5 text-blue-400" /> Whale Feed
             </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-dark-950/95 border-b border-dark-800 z-10">
                <tr>
                  <th className="p-3 text-[9px] font-black uppercase text-dark-500">Asset</th>
                  <th className="p-3 text-[9px] font-black uppercase text-dark-500">Side</th>
                  <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Value</th>
                  <th className="p-3 text-[9px] font-black uppercase text-dark-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-900/50">
                <AnimatePresence initial={false}>
                  {whaleTrades.map((trade) => (
                    <motion.tr 
                      key={trade.id} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="hover:bg-dark-900/30 transition-all group cursor-pointer"
                      onClick={() => window.open(`https://hypurrscan.io/tx/${trade.hash}`, '_blank')}
                    >
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-white">{trade.coin}</span>
                          <span className={clsx("text-[8px] font-bold uppercase", trade.isSmartMoney ? "text-purple-400" : "text-dark-600")}>
                            {trade.isSmartMoney ? "Smart Whale" : "Whale"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", trade.side === 'B' ? "bg-brand-neon/10 text-brand-neon" : "bg-red-500/10 text-red-500")}>
                          {trade.side === 'B' ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-[11px] font-black text-white">${trade.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          className="p-1.5 bg-dark-800 hover:bg-brand-neon hover:text-dark-1000 rounded transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAlert(trade.address);
                          }}
                        >
                          <Bell className="w-3 h-3" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* LIQUIDATION FEED */}
        <div className="flex-1 flex flex-col border-r border-dark-900 overflow-hidden bg-dark-1000/20">
          <div className="p-3 bg-dark-950/80 border-b border-dark-900 flex justify-between items-center shrink-0">
             <div className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
               <Skull className="w-3.5 h-3.5 text-red-500" /> Liquidations
             </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2 custom-scrollbar">
            <AnimatePresence initial={false}>
              {liquidations.map(liq => (
                <motion.div key={liq.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className={clsx("p-3 rounded-xl border group", liq.side === 'Long' ? "bg-red-500/5 border-red-500/20" : "bg-brand-neon/5 border-brand-neon/20")}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black text-white">{liq.coin}</div>
                      <div className={clsx("text-[8px] font-black uppercase tracking-widest mt-0.5", liq.side === 'Long' ? "text-red-500" : "text-brand-neon")}>
                        {liq.side === 'Long' ? '💀 REKT' : '🔥 SQUEEZE'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-black text-white tracking-tighter">${liq.usdValue.toLocaleString()}</div>
                      <div className="text-[8px] text-dark-600 font-mono mt-0.5">{liq.user.slice(0, 6)}...</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {liquidations.length === 0 && (
              <div className="py-20 text-center opacity-20 flex flex-col items-center">
                <Skull className="w-8 h-8 mb-2" />
                <span className="text-[9px] font-black uppercase tracking-widest">Waiting for blood...</span>
              </div>
            )}
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <LeaderboardPanel />
        </div>
      </div>
      <WhaleDetailsModal />
    </div>
  );
};
