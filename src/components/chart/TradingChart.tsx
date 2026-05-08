import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import { fetchCandles } from '../../api/hyperliquid';
import { useStore } from '../../store';

interface TradingChartProps {
  symbol: string;
  interval?: string;
}



export const TradingChart: React.FC<TradingChartProps> = ({ symbol, interval = '1h' }) => {
  const activeTool = useStore((s) => s.activeDrawingTool);
  const setActiveTool = useStore((s) => s.setActiveDrawingTool);
  const drawingBuffer = useStore((s) => s.drawingBuffer);
  const setDrawingBuffer = useStore((s) => s.setDrawingBuffer);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState(interval);

  useEffect(() => {
    setTimeframe(interval);
  }, [interval]);

  const userDrawings = useRef<any[]>([]);
  const liquidationLines = useRef<any[]>([]);
  const lastCandles = useRef<any[]>([]);
  const liquidations = useStore((s) => s.liquidations);

  // ── Initialize chart ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;
    const w = wrapper.clientWidth || window.innerWidth;
    const h = wrapper.clientHeight || 500;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#8B94A3',
      },
      grid: {
        vertLines: { color: '#0F0F0F' },
        horzLines: { color: '#0F0F0F' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#8B94A3', labelBackgroundColor: '#2A3042' },
        horzLine: { color: '#8B94A3', labelBackgroundColor: '#2A3042' },
      },
      rightPriceScale: { borderColor: '#2A3042' },
      timeScale: { borderColor: '#2A3042', timeVisible: true, secondsVisible: false },
      width: w,
      height: h,
    });

    chartRef.current = chart;

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00FFA3',
      downColor: '#FF4C4C',
      borderUpColor: '#00FFA3',
      borderDownColor: '#FF4C4C',
      wickUpColor: '#00FFA3',
      wickDownColor: '#FF4C4C',
    });

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(wrapper);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // ── Handle drawing logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const clickHandler = (param: any) => {
      if (!param.point || !param.time || !candleSeriesRef.current) return;
      if (activeTool === 'crosshair' || activeTool === 'zoom') return;

      if (activeTool === 'trash') {
        userDrawings.current.forEach(item => {
          if (item.price !== undefined) candleSeriesRef.current.removePriceLine(item);
          else chart.removeSeries(item);
        });
        userDrawings.current = [];
        setActiveTool('crosshair');
        return;
      }

      let price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) return;

      const candle = lastCandles.current.find(c => c.time === param.time);
      if (candle) {
        const targets = [candle.open, candle.high, candle.low, candle.close];
        const closest = targets.reduce((prev, curr) => Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev);
        if (Math.abs(closest - price) < price * 0.005) price = closest;
      }

      const time = param.time as number;

      if (activeTool === 'trendline') {
        if (!drawingBuffer) setDrawingBuffer({ time, price });
        else {
          const lineSeries = chart.addSeries(LineSeries, { color: '#00FFA3', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          const sortedPoints = [{ time: drawingBuffer.time, value: drawingBuffer.price }, { time: time, value: price }].sort((a, b) => (a.time as number) - (b.time as number));
          lineSeries.setData(sortedPoints);
          userDrawings.current.push(lineSeries);
          setDrawingBuffer(null);
          setActiveTool('crosshair');
        }
      } else {
        const line = candleSeriesRef.current.createPriceLine({ price, color: '#8B94A3', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: activeTool.toUpperCase() });
        userDrawings.current.push(line);
        setActiveTool('crosshair');
      }
    };

    chart.subscribeClick(clickHandler);
    return () => chart.unsubscribeClick(clickHandler);
  }, [activeTool, setActiveTool, drawingBuffer, setDrawingBuffer]);

  // ── High Frequency REAL-TIME Data Polling ────────────────────────────
    const loadCandles = useCallback(async (isInitial = false) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    
    try {
      const raw = await fetchCandles(symbol, timeframe, 200);
      if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
      if (!raw || !Array.isArray(raw) || raw.length === 0) return;

      const candles = raw.map((c: any) => ({
        time: Math.floor(c.t / 1000),
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
      }));

      const volumes = raw.map((c: any) => ({
        time: Math.floor(c.t / 1000),
        value: parseFloat(c.v),
        color: parseFloat(c.c) >= parseFloat(c.o) ? 'rgba(0, 255, 163, 0.25)' : 'rgba(255, 76, 76, 0.25)',
      }));

      // If initial load or major reset, use setData
      if (isInitial || lastCandles.current.length === 0) {
        candleSeriesRef.current.setData(candles);
        volumeSeriesRef.current.setData(volumes);
        chartRef.current.timeScale().fitContent();
      } else {
        // Real-time update logic: Push only the latest point
        const latest = candles[candles.length - 1];
        const latestVol = volumes[volumes.length - 1];
        candleSeriesRef.current.update(latest);
        volumeSeriesRef.current.update(latestVol);
      }
      
      lastCandles.current = candles;
    } catch (err) {
      console.error('[TradingChart] loading error:', err);
    }
  }, [symbol, timeframe]);

  // ── Ticker Simulation for Mock Assets ────────────────────────────────
  useEffect(() => {
    loadCandles(true);
    
    // Low-latency polling (2 seconds)
    const pollId = setInterval(() => loadCandles(false), 2000);

    // High-latency full refresh (optional for data integrity)
    const refreshId = setInterval(() => loadCandles(true), 15000);

    return () => {
      clearInterval(pollId);
      clearInterval(refreshId);
    };
  }, [loadCandles]);

  // ── LIQUIDATION HEATMAP OVERLAY ──────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    
    // Clear old liquidation lines
    liquidationLines.current.forEach(line => candleSeriesRef.current.removePriceLine(line));
    liquidationLines.current = [];

    // Filter liquidations for this symbol
    const activeLiqs = liquidations.filter(l => l.coin === symbol).slice(0, 5); // Show latest 5

    activeLiqs.forEach(liq => {
      const line = candleSeriesRef.current.createPriceLine({
        price: parseFloat(liq.px),
        color: liq.side === 'Long' ? 'rgba(255, 76, 76, 0.4)' : 'rgba(0, 255, 163, 0.4)',
        lineWidth: 2,
        lineStyle: 2, // LargeDashed
        axisLabelVisible: true,
        title: liq.side === 'Long' ? '💀 REKT' : '🔥 SQUEEZE',
      });
      liquidationLines.current.push(line);
    });
  }, [liquidations, symbol]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={wrapperRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={chartContainerRef} style={{ position: 'absolute', inset: 0 }} />
        {drawingBuffer && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-neon text-dark-1000 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg z-50 animate-bounce">CLICK SECOND POINT TO COMPLETE TRENDLINE</div>}
      </div>
    </div>
  );
};
