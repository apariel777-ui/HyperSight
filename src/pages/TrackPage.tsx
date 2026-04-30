import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ExternalLink, 
  Bell, 
  TrendingUp, 
  ShieldCheck,
  MousePointer2,
  Filter,
  Waves
} from 'lucide-react';
import { useStore, type WhaleTrade } from '../store';
import clsx from 'clsx';

const WHALE_THRESHOLD = 25000;
const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';

// Some legendary HL wallets/known whales
const SMART_MONEY_WALLETS = [
  '0x6431945a6669b2d863f68ef8e747372b0c363b9f', // Legend 1
  '0x8623b976269661a29f8c5b169f9e71b26938a9a6', // Legend 2
];

export const TrackPage: React.FC = () => {
  const whaleTrades = useStore((s) => s.whaleTrades);
  const addWhaleTrade = useStore((s) => s.addWhaleTrade);
  const tgUsername = useStore((s) => s.tgUsername);
  const [isConnected, setIsConnected] = useState(false);
  const [alertingWallet, setAlertingWallet] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const handleSetAlert = async (walletAddress: string) => {
    if (!tgUsername) {
      alert("Please set your Telegram username in the Auctions tab first!");
      return;
    }

    setAlertingWallet(walletAddress);
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
    } finally {
      setAlertingWallet(null);
    }
  };

  // Statistics
  const totalVolume = whaleTrades.reduce((acc, t) => acc + t.usdValue, 0);
  const buyCount = whaleTrades.filter(t => t.side === 'B').length;
  const sellCount = whaleTrades.filter(t => t.side === 'S').length;

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(HL_WS_URL);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        // Subscribe to all trades
        // On HL, subscribing to 'trades' without a coin gets you all trades on the L1
        ws.current?.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "allMids" } // We need allMids to get prices for value calc if not in trade msg
        }));
        
        ws.current?.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin: "BTC" } // Start with big ones
        }));
        
        // In a real app, we'd subscribe to all active coins. 
        // For this demo, let's track the majors and HYPE
        ["ETH", "SOL", "HYPE", "ARB", "AVAX", "DOGE"].forEach(coin => {
          ws.current?.send(JSON.stringify({
            method: "subscribe",
            subscription: { type: "trades", coin }
          }));
        });
      };

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'trades' && msg.data) {
          msg.data.forEach((trade: any) => {
            const usdValue = parseFloat(trade.px) * parseFloat(trade.sz);
            if (usdValue >= WHALE_THRESHOLD) {
              const newTrade: WhaleTrade = {
                id: `${trade.hash}-${trade.time}`,
                coin: trade.coin,
                side: trade.side,
                px: trade.px,
                sz: trade.sz,
                time: trade.time,
                hash: trade.hash,
                usdValue: usdValue,
                isSmartMoney: SMART_MONEY_WALLETS.includes(trade.hash.toLowerCase())
              };
              addWhaleTrade(newTrade);
            }
          });
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 3000); // Reconnect
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
          <div className="text-[10px] text-dark-600 font-bold mt-1 uppercase">Total 24H Radar Volume</div>
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
          <div className="text-[10px] text-dark-600 font-bold mt-1 uppercase">Large Order Distribution</div>
        </div>

        <div className="p-6 border-r border-dark-900">
          <div className="flex items-center gap-2 text-dark-500 text-[10px] font-black uppercase tracking-widest mb-1">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            Threshold
          </div>
          <div className="text-2xl font-black text-white tracking-tighter">
            $25.0K+
          </div>
          <div className="text-[10px] text-dark-600 font-bold mt-1 uppercase">Minimum Trade Size Filter</div>
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
          <div className="text-[10px] text-dark-600 font-bold mt-1 uppercase tracking-tight">Monitoring Hyperliquid L1</div>
        </div>
      </div>

      {/* FEED TABLE */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-dark-1000/95 backdrop-blur-md z-10">
            <tr className="border-b border-dark-900">
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500">Player</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500">Market</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 text-center">Direction</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 text-right">Price</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 text-right">Size</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 text-right">Value (USD)</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-dark-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {whaleTrades.map((trade) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0, x: -20, backgroundColor: trade.side === 'B' ? 'rgba(0,255,163,0.05)' : 'rgba(239,68,68,0.05)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                  transition={{ duration: 0.5 }}
                  className="border-b border-dark-900 group hover:bg-dark-900/50 transition-all cursor-crosshair"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center border",
                        trade.isSmartMoney 
                          ? "bg-purple-500/10 border-purple-500/20 text-purple-400" 
                          : "bg-dark-800 border-dark-700 text-dark-400"
                      )}>
                        {trade.isSmartMoney ? <ShieldCheck className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4 opacity-50" />}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white tracking-tight font-mono">
                          {trade.hash.slice(0, 6)}...{trade.hash.slice(-4)}
                        </div>
                        {trade.isSmartMoney && (
                          <div className="text-[8px] font-black text-purple-400 uppercase tracking-widest mt-0.5">Smart Money</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-dark-800 flex items-center justify-center text-[8px] font-black text-white">
                        {trade.coin[0]}
                      </div>
                      <span className="text-[12px] font-black text-white tracking-tighter">{trade.coin}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <div className={clsx(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        trade.side === 'B' 
                          ? "bg-brand-neon/5 border-brand-neon/20 text-brand-neon shadow-[0_0_10px_rgba(0,255,163,0.1)]" 
                          : "bg-red-500/5 border-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                      )}>
                        {trade.side === 'B' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.side === 'B' ? 'Long' : 'Short'}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-[12px] font-mono text-dark-100 font-bold">${parseFloat(trade.px).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-[12px] font-mono text-dark-300 font-bold">{parseFloat(trade.sz).toLocaleString()} {trade.coin}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[14px] font-black text-white tracking-tighter">
                        ${trade.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[9px] text-dark-500 font-bold uppercase tracking-tighter">
                        {trade.usdValue > 100000 ? '🐋 Mega Whale' : trade.usdValue > 50000 ? '🐬 Whale' : '🐟 Big Trade'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleSetAlert(trade.hash)}
                        disabled={alertingWallet === trade.hash}
                        className={clsx(
                          "p-2 rounded-lg transition-all",
                          alertingWallet === trade.hash ? "bg-dark-700 text-dark-500" : "bg-dark-800 hover:bg-brand-neon hover:text-dark-1000 text-dark-400"
                        )}
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => window.open(`https://app.hyperliquid.xyz/trade/${trade.coin}`, '_blank')}
                        className="p-2 bg-dark-800 hover:bg-brand-neon hover:text-dark-1000 rounded-lg text-dark-400 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
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
  );
};
