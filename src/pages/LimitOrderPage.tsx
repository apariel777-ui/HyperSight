import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';
import clsx from 'clsx';

const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const RADAR_COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'ARB', 'AVAX', 'DOGE', 'SUI', 'TIA', 'OP'];
const DEPTH_PCT = 0.05;   // ±5% from mid price only
const UPDATE_MS = 1000;   // Throttle UI to 1-second intervals
const BIN_COUNT = 12;     // Price bins per side

interface PriceBin {
  price: number;
  usdValue: number;
  size: number;
}

interface DepthSnapshot {
  coin: string;
  midPrice: number;
  bids: PriceBin[];   // sorted price desc (high → low)
  asks: PriceBin[];   // sorted price asc  (low → high)
  totalBidUsd: number;
  totalAskUsd: number;
}

type RawLevel = { px: string; sz: string };
type RawBook  = { coin: string; time: number; levels: [RawLevel[], RawLevel[]] };

// ---------- helpers ----------

function aggregateBook(
  levels: RawLevel[],
  midPrice: number,
  isBid: boolean
): PriceBin[] {
  if (!levels.length || midPrice === 0) return [];

  // Filter to ±5% of mid
  const filtered = levels.filter(l => {
    const px = parseFloat(l.px);
    return isBid
      ? px >= midPrice * (1 - DEPTH_PCT) && px <= midPrice
      : px <= midPrice * (1 + DEPTH_PCT) && px >= midPrice;
  });

  if (!filtered.length) return [];

  // Price range for binning
  const prices = filtered.map(l => parseFloat(l.px));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const range = hi - lo || 1;
  const binSize = range / BIN_COUNT;

  const bins: Map<number, PriceBin> = new Map();
  filtered.forEach(l => {
    const px = parseFloat(l.px);
    const sz = parseFloat(l.sz);
    const binKey = Math.floor((px - lo) / binSize);
    const binPrice = lo + binKey * binSize + binSize / 2;
    const existing = bins.get(binKey);
    if (existing) {
      existing.usdValue += px * sz;
      existing.size += sz;
    } else {
      bins.set(binKey, { price: binPrice, usdValue: px * sz, size: sz });
    }
  });

  const result = Array.from(bins.values());
  return isBid
    ? result.sort((a, b) => b.price - a.price)
    : result.sort((a, b) => a.price - b.price);
}

function buildSnapshot(book: RawBook): DepthSnapshot {
  const bids = book.levels[0];
  const asks = book.levels[1];

  const bestBid = bids.length ? parseFloat(bids[0].px) : 0;
  const bestAsk = asks.length ? parseFloat(asks[0].px) : 0;
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;

  const aggBids = aggregateBook(bids, midPrice, true);
  const aggAsks = aggregateBook(asks, midPrice, false);

  return {
    coin: book.coin,
    midPrice,
    bids: aggBids,
    asks: aggAsks,
    totalBidUsd: aggBids.reduce((s, b) => s + b.usdValue, 0),
    totalAskUsd: aggAsks.reduce((s, b) => s + b.usdValue, 0),
  };
}

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString(undefined, { minimumFractionDigits: 0 }) :
    v >= 1 ? v.toFixed(3) : v.toFixed(6);
}

// ---------- Depth Bar Row ----------
const DepthRow: React.FC<{
  bin: PriceBin;
  maxUsd: number;
  side: 'bid' | 'ask';
  midPrice: number;
}> = ({ bin, maxUsd, side, midPrice }) => {
  const pct = maxUsd > 0 ? (bin.usdValue / maxUsd) * 100 : 0;
  const distPct = Math.abs((bin.price - midPrice) / midPrice) * 100;
  const isBid = side === 'bid';

  return (
    <div className="relative flex items-center h-8 overflow-hidden group">
      {/* Bar */}
      <div
        className={clsx(
          'absolute top-0 bottom-0 transition-all duration-700',
          isBid ? 'right-0 bg-brand-neon/15' : 'left-0 bg-red-500/15'
        )}
        style={{ width: `${pct}%` }}
      />
      {/* Labels */}
      <div className="relative z-10 flex w-full items-center justify-between px-3">
        <span className={clsx('font-mono text-[11px]', isBid ? 'text-brand-neon' : 'text-red-400')}>
          {fmtPrice(bin.price)}
        </span>
        <span className="font-mono text-[10px] text-dark-500">{distPct.toFixed(2)}%</span>
        <span className="font-mono text-[11px] text-white">{fmtUsd(bin.usdValue)}</span>
      </div>
    </div>
  );
};

// ---------- Pressure Gauge ----------
const PressureGauge: React.FC<{ buyUsd: number; sellUsd: number }> = ({ buyUsd, sellUsd }) => {
  const total = buyUsd + sellUsd;
  const buyPct = total > 0 ? Math.round((buyUsd / total) * 100) : 50;
  const sellPct = 100 - buyPct;
  const dominant = buyPct > 55 ? 'Bullish Pressure' : buyPct < 45 ? 'Bearish Pressure' : 'Balanced Market';
  const dominantColor = buyPct > 55 ? 'text-brand-neon' : buyPct < 45 ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800 flex flex-col gap-3">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 flex items-center gap-2">
        <BarChart2 className="w-3 h-3" /> Wall Pressure
      </div>
      <div className={clsx('text-lg font-black tracking-tight', dominantColor)}>{dominant}</div>
      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        <motion.div
          className="bg-brand-neon h-full rounded-l-full"
          animate={{ width: `${buyPct}%` }}
          transition={{ duration: 0.8 }}
        />
        <motion.div
          className="bg-red-500 h-full rounded-r-full"
          animate={{ width: `${sellPct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-black text-brand-neon">{buyPct}% Buyers</span>
        <span className="text-[10px] font-black text-red-400">{sellPct}% Sellers</span>
      </div>
    </div>
  );
};

// ---------- Main Page ----------
export const LimitOrderPage: React.FC = () => {
  const [activeCoin, setActiveCoin] = useState('BTC');
  const [snapshots, setSnapshots] = useState<Map<string, DepthSnapshot>>(new Map());
  const booksRef = useRef<Map<string, RawBook>>(new Map());
  const ws = useRef<WebSocket | null>(null);

  // 1-second batch flush: processes buffered books into display state
  useEffect(() => {
    const timer = setInterval(() => {
      const newSnapshots = new Map<string, DepthSnapshot>();
      booksRef.current.forEach((book, coin) => {
        newSnapshots.set(coin, buildSnapshot(book));
      });
      if (newSnapshots.size > 0) {
        setSnapshots(newSnapshots);
      }
    }, UPDATE_MS);
    return () => clearInterval(timer);
  }, []);

  // WebSocket — buffers raw books into ref only, no state writes here
  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(HL_WS_URL);

      ws.current.onopen = () => {
        RADAR_COINS.forEach(coin => {
          ws.current?.send(JSON.stringify({
            method: 'subscribe',
            subscription: { type: 'l2Book', coin }
          }));
        });
      };

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.channel === 'l2Book' && msg.data?.levels) {
            // Write to ref only — no setState, no re-render
            booksRef.current.set(msg.data.coin, msg.data);
          }
        } catch (_) { /* ignore parse errors */ }
      };

      ws.current.onclose = () => setTimeout(connect, 3000);
      ws.current.onerror  = () => ws.current?.close();
    };

    connect();
    return () => ws.current?.close();
  }, []);

  const snap = snapshots.get(activeCoin);
  const maxUsd = snap ? Math.max(
    ...snap.bids.map(b => b.usdValue),
    ...snap.asks.map(a => a.usdValue),
    1
  ) : 1;

  const totalBuyUsdAll  = Array.from(snapshots.values()).reduce((s, v) => s + v.totalBidUsd, 0);
  const totalSellUsdAll = Array.from(snapshots.values()).reduce((s, v) => s + v.totalAskUsd, 0);

  return (
    <div className="flex flex-col h-full bg-dark-1000 p-6 gap-5 overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Order Walls</h1>
          <p className="text-dark-500 text-xs font-mono mt-0.5">
            Aggregated limit orders within ±5% of mid · live from Hyperliquid L1
          </p>
        </div>
        <a
          href="https://app.hyperliquid.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-dark-950 border border-brand-neon/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-neon hover:bg-brand-neon/10 transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
          Verify On-Chain
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-3 gap-5 shrink-0">
        <PressureGauge buyUsd={totalBuyUsdAll} sellUsd={totalSellUsdAll} />

        <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-brand-neon" /> Buy Wall Depth
          </div>
          <div className="text-2xl font-black text-brand-neon tracking-tight">{fmtUsd(totalBuyUsdAll)}</div>
          <div className="text-[10px] text-dark-600 mt-1">Total within ±5% mid</div>
        </div>

        <div className="p-5 rounded-2xl bg-dark-950 border border-dark-800">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-dark-500 mb-2 flex items-center gap-2">
            <TrendingDown className="w-3 h-3 text-red-400" /> Sell Wall Depth
          </div>
          <div className="text-2xl font-black text-red-400 tracking-tight">{fmtUsd(totalSellUsdAll)}</div>
          <div className="text-[10px] text-dark-600 mt-1">Total within ±5% mid</div>
        </div>
      </div>

      {/* COIN TABS */}
      <div className="flex gap-2 flex-wrap shrink-0">
        {RADAR_COINS.map(coin => {
          const s = snapshots.get(coin);
          const hasData = !!s;
          return (
            <button
              key={coin}
              onClick={() => setActiveCoin(coin)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border',
                activeCoin === coin
                  ? 'bg-dark-800 text-white border-dark-600'
                  : 'bg-dark-950 text-dark-500 border-dark-900 hover:text-white hover:border-dark-700'
              )}
            >
              {coin}
              {hasData && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-brand-neon align-middle" />
              )}
            </button>
          );
        })}
      </div>

      {/* DEPTH BOOK */}
      <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">

        {/* BID SIDE */}
        <div className="flex flex-col bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-900 bg-dark-900/50 shrink-0">
            <div className="flex items-center gap-2 text-brand-neon">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Buy Walls</span>
            </div>
            <span className="text-[10px] font-black text-brand-neon">{fmtUsd(snap?.totalBidUsd ?? 0)}</span>
          </div>
          {/* Column headers */}
          <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-black uppercase text-dark-600 border-b border-dark-900 shrink-0">
            <span>Price</span><span className="text-center">Dist%</span><span className="text-right">USD Value</span>
          </div>
          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-dark-900/50">
            {snap?.bids.map((bin, i) => (
              <DepthRow key={i} bin={bin} maxUsd={maxUsd} side="bid" midPrice={snap.midPrice} />
            ))}
            {!snap && (
              <div className="flex flex-col items-center justify-center h-full text-dark-700">
                <Activity className="w-6 h-6 mb-2 animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest">Connecting…</span>
              </div>
            )}
          </div>
        </div>

        {/* ASK SIDE */}
        <div className="flex flex-col bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-900 bg-dark-900/50 shrink-0">
            <div className="flex items-center gap-2 text-red-400">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sell Walls</span>
            </div>
            <span className="text-[10px] font-black text-red-400">{fmtUsd(snap?.totalAskUsd ?? 0)}</span>
          </div>
          {/* Column headers */}
          <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-black uppercase text-dark-600 border-b border-dark-900 shrink-0">
            <span>Price</span><span className="text-center">Dist%</span><span className="text-right">USD Value</span>
          </div>
          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-dark-900/50">
            {snap?.asks.map((bin, i) => (
              <DepthRow key={i} bin={bin} maxUsd={maxUsd} side="ask" midPrice={snap.midPrice} />
            ))}
            {!snap && (
              <div className="flex flex-col items-center justify-center h-full text-dark-700">
                <Activity className="w-6 h-6 mb-2 animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest">Connecting…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MID PRICE FOOTER */}
      {snap && (
        <div className="shrink-0 flex items-center justify-center gap-3 py-2">
          <span className="text-dark-600 text-[10px] font-bold uppercase tracking-widest">Mid Price</span>
          <span className="text-white font-mono font-black text-lg">${fmtPrice(snap.midPrice)}</span>
          <a
            href={`https://app.hyperliquid.xyz/trade/${activeCoin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-black uppercase text-brand-neon/60 hover:text-brand-neon flex items-center gap-1 transition-all"
          >
            Trade on HL <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
