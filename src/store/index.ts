import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface WhaleTrade {
  id: string;
  coin: string;
  side: 'B' | 'S';
  px: string;
  sz: string;
  time: number;
  hash: string;
  usdValue: number;
  isSmartMoney?: boolean;
}

export interface Liquidation {
  id: string;
  coin: string;
  side: 'Long' | 'Short';
  px: string;
  sz: string;
  time: number;
  usdValue: number;
  user: string;
}

export interface LimitOrder {
  coin: string;
  side: 'Buy' | 'Sell';
  px: string;
  sz: string;
  usdValue: number;
  timestamp: number;
}
export interface LeaderboardEntry {
  ethAddress: string;
  accountValue: string;
  pnl: string;
  winRate: number;
  rank: number;
}

export interface WhalePosition {
  coin: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  side: 'Long' | 'Short';
}

export interface WhalePortfolio {
  address: string;
  totalValue: string;
  withdrawable: string;
  positions: WhalePosition[];
}

interface StoreState {
  selectedMarket: string;
  setSelectedMarket: (market: string) => void;
  selectedCategory: 'Crypto' | 'Stocks' | 'Indices' | 'Commodities';
  setSelectedCategory: (category: 'Crypto' | 'Stocks' | 'Indices' | 'Commodities') => void;
  activeDrawingTool: string;
  setActiveDrawingTool: (tool: string) => void;
  drawingBuffer: { time: number; price: number } | null;
  setDrawingBuffer: (point: { time: number; price: number } | null) => void;
  openPositions: Array<any>;
  setOpenPositions: (positions: Array<any>) => void;
  tradeHistory: Array<any>;
  addTradeHistory: (trade: any) => void;
  whaleTrades: WhaleTrade[];
  addWhaleTrade: (trade: WhaleTrade) => void;
  liquidations: Liquidation[];
  addLiquidation: (liq: Liquidation) => void;
  tgUsername: string;
  setTgUsername: (username: string) => void;
  leaderboard: LeaderboardEntry[];
  setLeaderboard: (data: LeaderboardEntry[]) => void;
  limitOrders: LimitOrder[];
  setLimitOrders: (orders: LimitOrder[]) => void;
  addLimitOrder: (order: LimitOrder) => void;
  selectedWhale: WhalePortfolio | null;
  setSelectedWhale: (data: WhalePortfolio | null) => void;
  wallSnapshots: Record<string, unknown>;
  setWallSnapshot: (coin: string, snap: unknown) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedMarket: 'BTC',
      setSelectedMarket: (market) => set({ selectedMarket: market }),
      selectedCategory: 'Crypto',
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      activeDrawingTool: 'crosshair',
      setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),
      drawingBuffer: null,
      setDrawingBuffer: (point) => set({ drawingBuffer: point }),
      openPositions: [],
      setOpenPositions: (positions) => set({ openPositions: positions }),
      tradeHistory: [],
      addTradeHistory: (trade) => set((state) => ({ tradeHistory: [trade, ...state.tradeHistory] })),
      whaleTrades: [],
      addWhaleTrade: (trade) => set((state) => ({ 
        whaleTrades: [trade, ...state.whaleTrades].slice(0, 100) 
      })),
      liquidations: [],
      addLiquidation: (liq) => set((state) => ({ 
        liquidations: [liq, ...state.liquidations].slice(0, 100) 
      })),
      tgUsername: '',
      setTgUsername: (username) => set({ tgUsername: username }),
      leaderboard: [],
      setLeaderboard: (data) => set({ leaderboard: data }),
      selectedWhale: null,
      setSelectedWhale: (data: WhalePortfolio | null) => set({ selectedWhale: data }),
      wallSnapshots: {},
      setWallSnapshot: (coin, snap) => set((state) => ({
        wallSnapshots: { ...state.wallSnapshots, [coin]: snap }
      })),
      limitOrders: [],
      setLimitOrders: (orders) => set({ limitOrders: orders }),
      addLimitOrder: (order: LimitOrder) => set((state) => {
        const filtered = state.limitOrders.filter(o => 
          !(o.coin === order.coin && o.px === order.px && o.side === order.side)
        );
        return { limitOrders: [order, ...filtered].slice(0, 500) };
      }),
    }),
    {
      name: 'hypersight-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        whaleTrades: state.whaleTrades, 
        liquidations: state.liquidations,
        tgUsername: state.tgUsername,
        limitOrders: state.limitOrders,
        tradeHistory: state.tradeHistory
      }),
    }
  )
);
