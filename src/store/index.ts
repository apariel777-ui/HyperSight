import { create } from 'zustand';

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
}

export const useStore = create<StoreState>((set) => ({
  selectedMarket: 'BTC',
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  selectedCategory: 'Crypto',
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  activeDrawingTool: 'crosshair',
  setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),
  drawingBuffer: null,
  setDrawingBuffer: (point) => set({ drawingBuffer: point }),
  openPositions: [
    { id: '1', asset: 'BTC', side: 'Long', entryPrice: 65000, currentPrice: 66200, size: 0.5, pnl: 600, liqudationPrice: 61000 },
    { id: '2', asset: 'ETH', side: 'Short', entryPrice: 3500, currentPrice: 3450, size: 10, pnl: 500, liqudationPrice: 3800 }
  ],
  setOpenPositions: (positions) => set({ openPositions: positions }),
  tradeHistory: [
    { id: '1', asset: 'SOL', side: 'Long', price: 140, size: 50, timestamp: Date.now() - 86400000, pnl: 250, builder: 'HyperSight' }
  ],
  addTradeHistory: (trade) => set((state) => ({ tradeHistory: [trade, ...state.tradeHistory] })),
}));
