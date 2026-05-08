import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';

const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RADAR_COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'ARB', 'AVAX', 'DOGE', 'SUI', 'TIA', 'OP'];
const DEPTH_PCT = 0.05;
const UPDATE_MS = 1000;
const BIN_COUNT = 12;

// ── Module-level singletons — survive component unmount/remount ──────────────
interface PriceBin  { price: number; usdValue: number; size: number }
interface DepthSnapshot {
  coin: string; midPrice: number;
  bids: PriceBin[]; asks: PriceBin[];
  totalBidUsd: number; totalAskUsd: number;
}
type RawLevel = { px: string; sz: string };
type RawBook  = { coin: string; time: number; levels: [RawLevel[], RawLevel[]] };

const _books  = new Map<string, RawBook>();           // raw WS buffer
let   _ws: WebSocket | null = null;
let   _timer: ReturnType<typeof setInterval> | null = null;

function aggregateBook(levels: RawLevel[], midPrice: number, isBid: boolean): PriceBin[] {
  if (!levels.length || midPrice === 0) return [];
  const filtered = levels.filter(l => {
    const px = parseFloat(l.px);
    return isBid
      ? px >= midPrice * (1 - DEPTH_PCT) && px <= midPrice
      : px <= midPrice * (1 + DEPTH_PCT) && px >= midPrice;
  });
  if (!filtered.length) return [];
  const prices = filtered.map(l => parseFloat(l.px));
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const binSize = (hi - lo || 1) / BIN_COUNT;
  const bins = new Map<number, PriceBin>();
  filtered.forEach(l => {
    const px = parseFloat(l.px), sz = parseFloat(l.sz);
    const key = Math.floor((px - lo) / binSize);
    const binPrice = lo + key * binSize + binSize / 2;
    const existing = bins.get(key);
    if (existing) { existing.usdValue += px * sz; existing.size += sz; }
    else bins.set(key, { price: binPrice, usdValue: px * sz, size: sz });
  });
  const result = Array.from(bins.values());
  return isBid ? result.sort((a, b) => b.price - a.price) : result.sort((a, b) => a.price - b.price);
}

function buildSnapshot(book: RawBook): DepthSnapshot {
  const [bids, asks] = book.levels;
  const bestBid = bids.length ? parseFloat(bids[0].px) : 0;
  const bestAsk = asks.length ? parseFloat(asks[0].px) : 0;
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
  const aggBids = aggregateBook(bids, midPrice, true);
  const aggAsks = aggregateBook(asks, midPrice, false);
  return { coin: book.coin, midPrice, bids: aggBids, asks: aggAsks,
    totalBidUsd: aggBids.reduce((s, b) => s + b.usdValue, 0),
    totalAskUsd: aggAsks.reduce((s, b) => s + b.usdValue, 0) };
}

function startFeed() {
  const store = useStore.getState();

  // 1-second batch flush
  if (!_timer) {
    _timer = setInterval(() => {
      _books.forEach((book, coin) => {
        store.setWallSnapshot(coin, buildSnapshot(book));
      });
    }, UPDATE_MS);
  }

  if (_ws && _ws.readyState !== WebSocket.CLOSED) return;

  const connect = () => {
    _ws = new WebSocket(HL_WS_URL);
    
    const timeout = setTimeout(() => {
      if (store.wallsConnectionStatus === 'connecting') {
        store.setWallsConnectionStatus('error');
      }
    }, 10000);

    _ws.onopen = () => {
      RADAR_COINS.forEach(coin =>
        _ws?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin } }))
      );
    };

    _ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.channel === 'l2Book' && msg.data?.levels) {
          if (store.wallsConnectionStatus !== 'connected') {
            store.setWallsConnectionStatus('connected');
            clearTimeout(timeout);
          }
          _books.set(msg.data.coin, msg.data);
        }
      } catch (_) { /* ignore */ }
    };

    _ws.onclose = () => {
      clearTimeout(timeout);
      setTimeout(connect, 3000);
    };

    _ws.onerror = () => {
      clearTimeout(timeout);
      store.setWallsConnectionStatus('error');
      _ws?.close();
    };
  };

  connect();
}
// ─────────────────────────────────────────────────────────────────────────────

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString(undefined, { minimumFractionDigits: 0 })
    : v >= 1 ? v.toFixed(3) : v.toFixed(6);
}

// ── Sub-components ────────────────────────────────────────────────────────────
const DepthRow: React.FC<{ bin: PriceBin; maxUsd: number; side: 'bid'|'ask'; midPrice: number }> = ({ bin, maxUsd, side, midPrice }) => {
  const pct = maxUsd > 0 ? (bin.usdValue / maxUsd) * 100 : 0;
  const distPct = Math.abs((bin.price - midPrice) / midPrice) * 100;
  const isBid = side === 'bid';
  return (
    <div className="relative flex items-center h-10 overflow-hidden group">
      <div className={clsx('absolute top-0 bottom-0 transition-all duration-700', isBid ? 'right-0 bg-brand-neon/15' : 'left-0 bg-red-500/15')} style={{ width: `${pct}%` }} />
      <div className="relative z-10 flex w-full items-center justify-between px-3">
        <span className={clsx('font-mono text-[11px]', isBid ? 'text-brand-neon' : 'text-red-400')}>{fmtPrice(bin.price)}</span>
        <span className="font-mono text-[10px] text-dark-500">{distPct.toFixed(2)}%</span>
        <span className="font-mono text-[11px] text-white">{fmtUsd(bin.usdValue)}</span>
      </div>
    </div>
  );
};

const PressureGauge: React.FC<{ buyUsd: number; sellUsd: number }> = ({ buyUsd, sellUsd }) => {
  const total = buyUsd + sellUsd;
  const buyPct = total > 0 ? Math.round((buyUsd / total) * 100) : 50;
  const sellPct = 100 - buyPct;
  const label = buyPct > 55 ? 'Bullish Pressure' : buyPct < 45 ? 'Bearish Pressure' : 'Balanced Market';
  const color = buyPct > 55 ? 'text-brand-neon' : buyPct < 45 ? 'text-red-400' : 'text-yellow-400';
  return (
    <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800 flex flex-col gap-3">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 flex items-center gap-2">
        <BarChart2 className="w-3 h-3" /> Wall Pressure
      </div>
      <div className={clsx('text-lg font-black tracking-tight', color)}>{label}</div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        <motion.div className="bg-brand-neon h-full rounded-l-full" animate={{ width: `${buyPct}%` }} transition={{ duration: 0.8 }} />
        <motion.div className="bg-red-500 h-full rounded-r-full"   animate={{ width: `${sellPct}%` }} transition={{ duration: 0.8 }} />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-black text-brand-neon">{buyPct}% Buyers</span>
        <span className="text-[10px] font-black text-red-400">{sellPct}% Sellers</span>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const LimitOrderPage: React.FC = () => {
  const [activeCoin, setActiveCoin] = useState('BTC');
  const status = useStore(s => s.wallsConnectionStatus);
  const wallSnapshots = useStore(s => s.wallSnapshots) as Record<string, DepthSnapshot>;

  useEffect(() => {
    startFeed();
  }, []);

  const snap      = wallSnapshots[activeCoin] as DepthSnapshot | undefined;
  const allBins = snap ? [...snap.bids, ...snap.asks] : [];
  const maxUsd = allBins.length > 0 
    ? allBins.reduce((max, b) => Math.max(max, b.usdValue), 1) 
    : 1;
  const allSnaps  = Object.values(wallSnapshots) as DepthSnapshot[];
  const totalBuy  = allSnaps.reduce((s, v) => s + v.totalBidUsd, 0);
  const totalSell = allSnaps.reduce((s, v) => s + v.totalAskUsd, 0);

  if (status === 'error' && !snap) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <Activity className="w-12 h-12 text-brand-red mb-4" />
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Connection Failed</h2>
        <p className="text-dark-400 mt-2 max-w-md">
          Unable to establish a real-time WebSocket connection to the Hyperliquid L1. 
          Please check your network or firewall settings.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-dark-900 text-white rounded-lg font-black uppercase tracking-widest border border-dark-800 hover:bg-dark-800"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-dark-1000 p-4 gap-4 overflow-y-auto h-full">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Order Walls</h1>
            <Link 
              to={`/token/${activeCoin}`}
              className="px-2 py-0.5 bg-dark-800 text-brand-neon text-[9px] font-black rounded border border-brand-neon/30 hover:bg-brand-neon hover:text-dark-1000 transition-all uppercase"
            >
              View {activeCoin} Profile
            </Link>
          </div>
          <p className="text-dark-500 text-xs font-mono mt-0.5">Aggregated limit orders within ±5% of mid · live from Hyperliquid L1</p>
        </div>
        <a href="https://app.hyperliquid.xyz" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-dark-950 border border-brand-neon/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-neon hover:bg-brand-neon/10 transition-all">
          <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
          Verify On-Chain <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-3 gap-4">
        <PressureGauge buyUsd={totalBuy} sellUsd={totalSell} />
        <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-brand-neon" /> Buy Wall Depth
          </div>
          <div className="text-2xl font-black text-brand-neon tracking-tight">{fmtUsd(totalBuy)}</div>
          <div className="text-[10px] text-dark-600 mt-1">Total within ±5% mid</div>
        </div>
        <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <TrendingDown className="w-3 h-3 text-red-400" /> Sell Wall Depth
          </div>
          <div className="text-2xl font-black text-red-400 tracking-tight">{fmtUsd(totalSell)}</div>
          <div className="text-[10px] text-dark-600 mt-1">Total within ±5% mid</div>
        </div>
      </div>

      {/* COIN TABS */}
      <div className="flex gap-2 flex-wrap">
        {RADAR_COINS.map(coin => (
          <button key={coin} onClick={() => setActiveCoin(coin)}
            className={clsx('px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border',
              activeCoin === coin ? 'bg-dark-800 text-white border-dark-600' : 'bg-dark-950 text-dark-500 border-dark-900 hover:text-white hover:border-dark-700')}>
            {coin}
            {wallSnapshots[coin] && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-brand-neon align-middle" />}
          </button>
        ))}
      </div>

      {/* DEPTH BOOK */}
      <div className="grid grid-cols-2 gap-4">

        {/* BID SIDE */}
        <div className="flex flex-col bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-900 bg-dark-900/50">
            <div className="flex items-center gap-2 text-brand-neon">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Buy Walls</span>
            </div>
            <span className="text-[10px] font-black text-brand-neon">{fmtUsd(snap?.totalBidUsd ?? 0)}</span>
          </div>
          <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-black uppercase text-dark-600 border-b border-dark-900">
            <span>Price</span><span className="text-center">Dist%</span><span className="text-right">USD Value</span>
          </div>
          <div className="divide-y divide-dark-900/50">
            {snap?.bids.map((bin, i) => (
              <DepthRow key={i} bin={bin} maxUsd={maxUsd} side="bid" midPrice={snap.midPrice} />
            ))}
            {!snap && (
              <div className="flex flex-col items-center justify-center py-16 text-dark-700">
                <Activity className="w-6 h-6 mb-2 animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest">Connecting…</span>
              </div>
            )}
          </div>
        </div>

        {/* ASK SIDE */}
        <div className="flex flex-col bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-900 bg-dark-900/50">
            <div className="flex items-center gap-2 text-red-400">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sell Walls</span>
            </div>
            <span className="text-[10px] font-black text-red-400">{fmtUsd(snap?.totalAskUsd ?? 0)}</span>
          </div>
          <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-black uppercase text-dark-600 border-b border-dark-900">
            <span>Price</span><span className="text-center">Dist%</span><span className="text-right">USD Value</span>
          </div>
          <div className="divide-y divide-dark-900/50">
            {snap?.asks.map((bin, i) => (
              <DepthRow key={i} bin={bin} maxUsd={maxUsd} side="ask" midPrice={snap.midPrice} />
            ))}
            {!snap && (
              <div className="flex flex-col items-center justify-center py-16 text-dark-700">
                <Activity className="w-6 h-6 mb-2 animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest">Connecting…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MID PRICE FOOTER */}
      {snap && (
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-dark-600 text-[10px] font-bold uppercase tracking-widest">Mid Price</span>
          <span className="text-white font-mono font-black text-lg">${fmtPrice(snap.midPrice)}</span>
          <a href={`https://app.hyperliquid.xyz/trade/${activeCoin}`} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-black uppercase text-brand-neon/60 hover:text-brand-neon flex items-center gap-1 transition-all">
            Trade on HL <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
