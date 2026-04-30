import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Gavel, Clock, Bell, Activity, History, Send, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchSpotDeployAuctions, fetchPerpDeployAuctions, HYPERLIQUID_WS_URL } from '../api/hyperliquid';

// High-volume perp markets guaranteed to have live trades
const LIVE_FEED_COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'ARB', 'DOGE', 'AVAX'];

type AuctionType = 'Spot Deploy' | 'Perp Deploy' | 'HIP-6';

interface RealAuction {
  id: string; // fallback if coin not provided
  token: string;
  type: AuctionType;
  startTimeSeconds: number;
  durationSeconds: number;
  startGas: number;
  currentGas?: number;
  endGas: number;
  status: 'Live' | 'Scheduled' | 'Settled';
  settlePrice?: number;
  clearedAt?: number;
}

interface BidEvent {
  id: string;
  token: string;
  bidder: string;
  amount: number | string;
  price: number | string;
  timestamp: number;
}

const formatTime = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getUrgencyColor = (timeLeftMs: number, totalTimeMs: number) => {
  if (totalTimeMs <= 0) return 'text-brand-neon border-brand-neon/30';
  const ratio = timeLeftMs / totalTimeMs;
  if (ratio > 0.3) return 'text-brand-neon border-brand-neon/30'; // Green
  if (ratio > 0.1) return 'text-yellow-400 border-yellow-400/50 glow-yellow'; // Yellow
  return 'text-brand-red border-brand-red/70 glow-red animate-pulse'; // Red
};

// --- Components ---

const PriceDecayCurve: React.FC<{ auction: RealAuction }> = ({ auction }) => {
  const { startGas, currentGas, endGas } = auction;
  
  // Calculate relative progress of time vs gas decay
  // We use currentGas for the precise placement
  const totalGasDrop = startGas - endGas;
  if (totalGasDrop <= 0 || startGas === 0) {
    return (
      <div className="h-16 w-full flex items-center justify-center border border-dark-800 rounded bg-dark-900/50 mt-4">
        <span className="text-[10px] text-dark-500 uppercase font-black tracking-widest">Curve Unavailable</span>
      </div>
    );
  }

  const elapsedGas = startGas - (currentGas ?? 0);
  const progress = Math.min(Math.max(elapsedGas / totalGasDrop, 0), 1);
  
  const width = 200;
  const height = 40;
  
  // The curve drops from top left to bottom right
  const currentX = progress * width;
  const currentY = progress * height;

  return (
    <div className="h-16 w-full mt-4 flex flex-col justify-end relative rounded overflow-hidden">
      <div className="text-[9px] text-dark-400 absolute top-0 right-0 font-mono">End Gas: {endGas}</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <path 
           d={`M 0 0 Q ${width/2} 0 ${width} ${height}`} 
           fill="none" 
           stroke="rgba(255,255,255,0.1)" 
           strokeWidth="2"
           strokeDasharray="4 4"
        />
        <path 
           d={`M 0 0 Q ${currentX/2} 0 ${currentX} ${currentY}`} 
           fill="none" 
           stroke="#00FFA3" 
           strokeWidth="3"
        />
        <circle cx={currentX} cy={currentY} r="4" fill="#00FFA3" className="animate-pulse" />
      </svg>
    </div>
  );
};

const TelegramAlertPanel = () => {
  const tgUsername = useStore((s) => s.tgUsername);
  const setGlobalTgUsername = useStore((s) => s.setTgUsername);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgUsername) return;
    
    setStatus('loading');
    try {
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tgUsername })
      });
      
      if (res.ok) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
      }
    } catch(err) {
      setStatus('error');
    }
  };

  return (
    <div className="bg-dark-950 border border-dark-900 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
      {status === 'success' ? (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
          <CheckCircle className="w-16 h-16 text-brand-neon mb-6" />
          <h3 className="text-2xl font-black uppercase text-white tracking-widest mb-2">Alert Configured!</h3>
          <p className="text-dark-400 max-w-md mx-auto mb-4 font-mono text-xs">
            We will immediately ping your Telegram the millisecond a new decentralized deployment registers on the L1 chain.
          </p>
        </motion.div>
      ) : (
        <>
          <Bell className="w-16 h-16 text-dark-600 mb-6" />
          <h3 className="text-2xl font-black uppercase text-white tracking-widest mb-2">Auction Radar Active</h3>
          <p className="text-dark-400 max-w-md mx-auto mb-8 font-mono text-xs">
            Enter your Telegram username below. Our backend Indexer will automatically notify you the moment a live Hyperliquid Auction starts.
          </p>
          
          <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
             <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500 font-bold">@</span>
               <input 
                 type="text"
                 placeholder="username"
                 value={tgUsername}
                 onChange={(e) => setGlobalTgUsername(e.target.value.replace('@', ''))}
                 className="w-full bg-dark-900 border border-dark-800 rounded px-10 py-3 text-white font-mono text-sm focus:border-brand-neon focus:outline-none transition-colors"
                 required
               />
             </div>
             
             <button 
               type="submit" 
               disabled={status === 'loading'}
               className="w-full py-4 bg-brand-neon text-dark-1000 font-black uppercase tracking-widest text-sm rounded hover:bg-white transition-all shadow-[0_0_20px_rgba(0,255,163,0.3)] flex items-center justify-center gap-3 disabled:opacity-50"
             >
               {status === 'loading' ? (
                 <Activity className="w-5 h-5 animate-spin" />
               ) : (
                 <>
                   <Send className="w-5 h-5" />
                   Add Telegram Alert
                 </>
               )}
             </button>
             
             {status === 'error' && (
               <p className="text-brand-red text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 mt-2">
                 <AlertCircle className="w-3 h-3" /> Failed to configure alert
               </p>
             )}
          </form>
        </>
      )}
    </div>
  );
};

export const AuctionsPage = () => {
  const [bids, setBids] = useState<BidEvent[]>([]);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'Live' | 'Scheduled' | 'History'>('Live');
  const [filterType, setFilterType] = useState<AuctionType | 'All'>('All');

  // Fetch Real Data
  const { data: spotDeployAuctions } = useQuery({
    queryKey: ['auctions', 'spotDeploy'],
    queryFn: fetchSpotDeployAuctions,
    refetchInterval: 5000 
  });

  const { data: perpDeployAuctions } = useQuery({
    queryKey: ['auctions', 'perpDeploy'],
    queryFn: fetchPerpDeployAuctions,
    refetchInterval: 5000 
  });

  // Timer loop for localized sub-second accuracy
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Format incoming raw arrays/objects into unified real auctions stream
  const activeAuctions = useMemo(() => {
    let combined: RealAuction[] = [];
    
    const processPayload = (payload: any, type: AuctionType) => {
      if (!payload) return;
      // Hyperliquid might return a single object or an array of objects
      const items = Array.isArray(payload) ? payload : [payload];
      items.forEach((item, idx) => {
         // Attempt to find fields, ignore errors if it doesn't match spot/perp struct
         if (typeof item.startTimeSeconds !== 'undefined') {
            // Filter out default/inactive structs where gas hasn't decayed or is exactly static
            // This fixes the issue where Spot and Perp return identical timers but one has startGas == currentGas (not actively deploying)
            if (item.startGas && item.currentGas && item.startGas === item.currentGas && item.startGas % 100 === 0) {
              return; // likely a generic uninitialized state (like 500 static)
            }

            const auction: RealAuction = {
              id: item.coin || item.name || `${type}-${idx}`,
              token: item.coin || item.name || `${type.split(' ')[0]} Asset`,
              type,
              startTimeSeconds: item.startTimeSeconds,
              durationSeconds: item.durationSeconds,
              startGas: item.startGas || 0,
              currentGas: item.currentGas || 0,
              endGas: item.endGas || 0,
              status: 'Live'
            };
            
            // Check if settled
            const nowSec = Math.floor(Date.now()/1000);
            if (nowSec > item.startTimeSeconds + item.durationSeconds) {
              // settled or ended, skip from live
            } else {
              combined.push(auction);
            }
         }
      });
    };

    processPayload(spotDeployAuctions, 'Spot Deploy');
    processPayload(perpDeployAuctions, 'Perp Deploy');

    // Deduplicate logic: if by some chance the API emits two auctions with the exact same startTime and duration,
    // they are likely bleeding states from the same deployment sequence in the RPC. We'll pick the one with active decay.
    const dedupedMap = new Map<number, RealAuction>();
    combined.forEach(auction => {
      const key = auction.startTimeSeconds;
      if (dedupedMap.has(key)) {
         const existing = dedupedMap.get(key)!;
         if (auction.currentGas !== undefined && existing.currentGas !== undefined) {
           if (auction.currentGas < auction.startGas && existing.currentGas === existing.startGas) {
             dedupedMap.set(key, auction);
           }
         } else {
           dedupedMap.set(key, auction);
         }
      } else {
         dedupedMap.set(key, auction);
      }
    });

    return Array.from(dedupedMap.values());
  }, [spotDeployAuctions, perpDeployAuctions]);

  // WebSocket — always subscribe to real high-volume perp markets for live feed
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe to active auction tokens + guaranteed high-volume perps
        const auctionCoins = activeAuctions.map(a => a.token);
        const allCoins = Array.from(new Set([...LIVE_FEED_COINS, ...auctionCoins]));
        allCoins.forEach(coin => {
          ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel === 'trades' && Array.isArray(data.data)) {
            data.data.forEach((t: any) => {
              const newBid: BidEvent = {
                id: t.hash || `${t.coin}-${t.time}-${Math.random()}`,
                token: t.coin || 'Unknown',
                bidder: `0x...${t.hash ? t.hash.slice(-4) : '????'}`,
                amount: t.sz,
                price: t.px,
                timestamp: t.time || Date.now()
              };
              setBids(prev => [newBid, ...prev].slice(0, 60));
            });
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        // Auto-reconnect after 3s if closed unexpectedly
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeAuctions]);

  const liveFiltered = activeAuctions.filter(a => filterType === 'All' || a.type === filterType);
  
  // History State
  const { data: historyData } = useQuery({
     queryKey: ['auctions', 'history'],
     queryFn: async () => {
        try {
          const res = await fetch('/api/auctions/history');
          const data = await res.json();
          return data.success ? data.data : [];
        } catch(e) {
          return [];
        }
     },
     refetchInterval: 15000
  });
  
  const historyAuctions: RealAuction[] = historyData || [];

  return (
    <div className="flex bg-dark-1000 h-[calc(100vh-64px)] overflow-hidden">
      
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-8 py-8 border-r border-dark-900">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,163,0.15)]">
              <Gavel className="w-6 h-6 text-brand-neon" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Auctions Terminal</h1>
              <p className="text-dark-400 text-xs font-bold uppercase tracking-widest mt-0.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" /> 
                Real-Time Data Feed Active
              </p>
            </div>
          </div>

          <div className="flex gap-2 bg-dark-950 border border-dark-800 p-1 rounded-lg">
            {(['Live', 'Scheduled', 'History'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === tab 
                    ? "bg-dark-800 text-white shadow-sm" 
                    : "text-dark-500 hover:text-white hover:bg-dark-900"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="mb-6 flex gap-3">
           <div className="text-[10px] font-bold text-dark-500 uppercase flex items-center px-2">Filter by Type:</div>
           {['All', 'Spot Deploy', 'Perp Deploy', 'HIP-6'].map(t => (
             <button 
                key={t}
                onClick={() => setFilterType(t as any)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all",
                  filterType === t ? "bg-brand-neon/20 border-brand-neon text-brand-neon" : "bg-dark-900 border-dark-800 text-dark-400 hover:border-dark-600"
                )}
             >
               {t}
             </button>
           ))}
        </div>

        {/* LIVE AUCTIONS TAB */}
        {activeTab === 'Live' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {liveFiltered.map(auction => {
              const totalDurationMs = auction.durationSeconds * 1000;
              const endTimeMs = (auction.startTimeSeconds + auction.durationSeconds) * 1000;
              const timeLeftMs = Math.max(endTimeMs - now, 0);
              const urgencyClass = getUrgencyColor(timeLeftMs, totalDurationMs);

              return (
                <motion.div 
                  layout
                  key={auction.id} 
                  className={clsx(
                    "bg-dark-950 rounded-xl p-6 border shadow-2xl relative overflow-hidden transition-all duration-500",
                    urgencyClass.includes('glow-red') ? "border-brand-red shadow-[0_0_20px_rgba(255,76,76,0.15)]" : "border-dark-800"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                     <div>
                       <div className="flex items-center gap-3">
                         <h2 className="text-2xl font-black text-white tracking-tighter">{auction.token}</h2>
                         <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-dark-800 text-brand-neon border border-brand-neon/30 rounded">
                           {auction.type}
                         </span>
                       </div>
                       <p className="text-dark-400 text-xs mt-1 font-mono">Live Gas Decay</p>
                     </div>
                     <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded border bg-dark-900", urgencyClass)}>
                        <Clock className="w-4 h-4" />
                        <span className="font-mono font-bold">{formatTime(timeLeftMs)}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-6">
                    <div className="bg-dark-900 p-4 rounded-lg border border-dark-800">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-dark-500 mb-1">Current Gas</div>
                      <div className="text-xl font-mono text-white">{(auction.currentGas ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-dark-900 p-4 rounded-lg border border-dark-800">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-dark-500 mb-1">Start Gas</div>
                      <div className="text-xl font-mono text-dark-300">{auction.startGas.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* VISUAL GAS DECAY */}
                  <div className="pt-4 border-t border-dark-800/50">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-dark-500 flex justify-between">
                      <span>Gas Decay Curve (Live Network)</span>
                    </div>
                    <PriceDecayCurve auction={auction} />
                  </div>
                </motion.div>
              );
            })}
            
            {liveFiltered.length === 0 && (
              <div className="col-span-full py-20 text-center border border-dashed border-dark-800 rounded-xl">
                 <Activity className="w-8 h-8 text-dark-600 mx-auto mb-3" />
                 <p className="text-dark-400 font-bold uppercase tracking-widest text-[10px]">No Real Auctions Match Filter on Network</p>
                 <p className="text-dark-500 text-xs mt-2 font-mono">Fetching via HTTPS POST info endpoint...</p>
              </div>
            )}
          </div>
        )}

        {/* SCHEDULED / TELEGRAM ALERTS TAB */}
        {activeTab === 'Scheduled' && <TelegramAlertPanel />}

        {/* HISTORY & COMPARISON TAB */}
        {activeTab === 'History' && (
          <div className="bg-dark-950 border border-dark-900 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-dark-900/50 border-b border-dark-800 text-[10px] font-black tracking-widest uppercase text-dark-500">
                  <th className="p-5">Asset / Type</th>
                  <th className="p-5">Settled Time</th>
                  <th className="p-5">Start Gas</th>
                  <th className="p-5">Settle Gas (Price)</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-900">
                {historyAuctions.map(a => (
                  <tr key={a.id} className="hover:bg-dark-900/40 transition-colors">
                    <td className="p-5">
                      <div className="font-bold text-white mb-1">{a.token}</div>
                      <span className="text-[10px] text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded font-black uppercase">{a.type}</span>
                    </td>
                    <td className="p-5 text-dark-300 font-mono text-sm">{new Date(a.clearedAt || Date.now()).toLocaleString()}</td>
                    <td className="p-5 text-dark-400 font-mono text-sm line-through">{a.startGas?.toLocaleString()}</td>
                    <td className="p-5 text-brand-neon font-mono text-sm font-bold">{a.settlePrice?.toLocaleString()}</td>
                    <td className="p-5 text-right">
                      <button className="px-4 py-2 border border-dark-800 text-dark-300 rounded hover:bg-dark-800 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-end gap-2 ml-auto">
                        <History className="w-3.5 h-3.5" />
                        View Curve
                      </button>
                    </td>
                  </tr>
                ))}
                {historyAuctions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center flex flex-col items-center justify-center min-h-[250px]">
                       <History className="w-12 h-12 text-dark-800 mb-4 animate-spin-slow" />
                       <div className="text-dark-500 text-[10px] font-bold uppercase tracking-widest">
                          Local Daemon Indexer checking blocks...<br/><span className="text-dark-600 mt-2 block">No settled L1 auctions logged yet.</span>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: REAL-TIME BID FEED */}
      <div className="w-[350px] shrink-0 bg-dark-950 border-l border-dark-900 flex flex-col relative z-20">
        <div className="p-5 border-b border-dark-900 flex items-center justify-between bg-dark-1000">
          <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-neon" /> 
            Live Feed Explorer
          </h3>
          <div className="px-2 py-1 bg-brand-neon/10 text-brand-neon text-[9px] font-bold rounded flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-brand-neon rounded-full animate-ping" />
            WSS DATA FEED
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence initial={false}>
            {bids.map(bid => (
              <motion.div 
                key={bid.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-dark-900 border border-dark-800 rounded-lg p-3 text-sm relative overflow-hidden group"
              >
                {/* Ping effect on spawn */}
                <div className="absolute inset-0 bg-brand-neon/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[10px] text-brand-neon">{bid.token}</span>
                  <span className="font-mono text-[10px] text-dark-500">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                </div>
                
                <div className="flex justify-between items-end">
                   <div>
                     <div className="text-[10px] font-bold text-dark-600 uppercase tracking-widest mb-0.5">Bidder</div>
                     <div className="font-mono text-xs text-white">Wallet {bid.bidder}</div>
                   </div>
                   <div className="text-right flex flex-col items-end">
                     <span className="font-mono text-dark-300 text-xs">bid {bid.amount.toLocaleString()} size</span>
                     <span className="font-mono text-brand-neon font-bold text-[10px]">at {bid.price.toLocaleString()} price</span>
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {bids.length === 0 && (
             <div className="flex flex-col items-center text-center justify-center py-10 opacity-50">
               <Activity className="w-4 h-4 text-brand-neon mb-2 animate-spin" />
               <div className="text-dark-500 text-[10px] font-bold uppercase tracking-widest">
                  Listening to network trades...
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
