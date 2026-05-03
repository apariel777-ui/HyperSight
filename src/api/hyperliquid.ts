export const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';
export const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws';

export interface AssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  markPx: string;
}

export interface MetaData {
  universe: Array<{
    name: string;
    szDecimals: number;
  }>;
}

const MOCK_ASSETS: Record<string, string[]> = {
  Stocks: ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'NFLX', 'AMD', 'PLTR'],
  Indices: ['SPX', 'NDX', 'DJI', 'VIX', 'DAX', 'FTSE', 'NKY'],
  Commodities: ['GOLD', 'SILVER', 'OIL', 'GAS', 'COPPER', 'WHEAT', 'CORN']
};

const getBasePrice = (name: string) => {
  if (name === 'GOLD') return 2350.50;
  if (name === 'SILVER') return 28.30;
  if (name === 'OIL') return 85.40;
  if (name === 'SPX') return 5200.20;
  if (name === 'NDX') return 18100.50;
  if (name === 'NVDA') return 890.30;
  if (name === 'TSLA') return 175.60;
  return 100 + Math.random() * 900;
};

// HELPER for timeframe milliseconds
const getIntervalMs = (interval: string) => {
  const m = interval.toLowerCase();
  if (m === '1m') return 60 * 1000;
  if (m === '5m') return 5 * 60 * 1000;
  if (m === '15m') return 15 * 60 * 1000;
  if (m === '1h') return 60 * 60 * 1000;
  if (m === '4h') return 4 * 60 * 60 * 1000;
  if (m === '1d') return 24 * 60 * 60 * 1000;
  return 3600 * 1000;
};

export const fetchMarkets = async (category: string = 'Crypto') => {
  if (category === 'Crypto') {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    
    const data = await response.json();
    const meta: MetaData = data[0];
    const ctxs: AssetCtx[] = data[1];

    return meta.universe.map((asset, index) => {
      const ctx = ctxs[index];
      const markPx = parseFloat(ctx.markPx);
      const prevPx = parseFloat(ctx.prevDayPx);
      const change24h = ((markPx - prevPx) / prevPx) * 100;
      
      return {
        name: asset.name,
        markPx,
        change24h,
        volume24h: parseFloat(ctx.dayNtlVlm),
        openInterest: parseFloat(ctx.openInterest),
        fundingRate: parseFloat(ctx.funding) * 100,
      };
    });
  }

  // MOCK DATA for Stocks, Indices, Commodities
  const assets = MOCK_ASSETS[category] || [];
  return assets.map(name => {
    const base = getBasePrice(name);
    // Add a tiny random walk to make it 'tick'
    const tick = (Math.random() - 0.5) * (base * 0.0005);
    const markPx = base + tick;
    const change = (Math.random() - 0.3) * 4; 
    return {
      name,
      markPx,
      change24h: change,
      volume24h: Math.random() * 1000000,
      openInterest: Math.random() * 500000,
      fundingRate: 0,
    };
  });
};

export const fetchCandles = async (coin: string, interval: string = '1h', limit: number = 100) => {
  const isMock = Object.values(MOCK_ASSETS).flat().includes(coin);
  const intervalMs = getIntervalMs(interval);

  if (!isMock) {
    const endTime = Date.now();
    const startTime = endTime - intervalMs * limit;

    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin, interval, startTime, endTime }
      }),
    });
    
    const data = await response.json();
    return data;
  }

  // GENERATE MOCK CANDLES with spacing based on INTERVAL
  const base = getBasePrice(coin);
  let currentPrice = base;
  const now = Math.floor(Date.now() / intervalMs) * intervalMs;
  
  return Array.from({ length: limit }).map((_, i) => {
    const t = now - (limit - i) * intervalMs;
    const open = currentPrice;
    const volatility = 0.005; // 0.5%
    const close = currentPrice * (1 + (Math.random() - 0.49) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * (volatility / 2));
    const low = Math.min(open, close) * (1 - Math.random() * (volatility / 2));
    currentPrice = close;
    return {
      t,
      o: open.toString(),
      h: high.toString(),
      l: low.toString(),
      c: close.toString(),
      v: (Math.random() * 1000).toString(),
    };
  });
};

export const executeMockTrade = (coin: string, side: 'Buy' | 'Sell', sz: number, price: number, builderCode: string = 'HyperSight') => {
  console.log(`[TRADE EXECUTED] ${side} ${sz} ${coin} @ ${price}`);
  return { success: true, message: 'Order placed successfully', tradeDetails: { side, size: sz, coin, price, builderCode } };
};

export interface AuctionStatusResp {
  startTimeSeconds: number;
  durationSeconds: number;
  startGas: number;
  currentGas: number;
  endGas: number;
  // Note: we assume the response includes some identifying info like coin/token name, 
  // but if the API returns an array or object, we'll map it out in the frontend.
  coin?: string;
  name?: string;
}

export const fetchSpotDeployAuctions = async (): Promise<any> => {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'spotPairDeployAuctionStatus' }),
  });
  return response.json();
};

export const fetchPerpDeployAuctions = async (): Promise<any> => {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'perpDeployAuctionStatus' }),
  });
  return response.json();
};

export const fetchHip3Auctions = async (): Promise<any> => {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'hip3DeployAuctionStatus' }),
  });
  return response.json();
};

export const fetchLeaderboard = async (): Promise<any> => {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'leaderboard' }),
  });
  return response.json();
};
