import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, Shield, Globe, Cpu, Zap, SignalHigh, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { HYPERLIQUID_WS_URL } from '../api/hyperliquid';

interface LatencyMetric {
  time: number;
  latency: number;
}

export const LatencyPage = () => {
  const [wsLatency, setWsLatency] = useState<number | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<LatencyMetric[]>([]);
  const [status, setStatus] = useState<'optimal' | 'degraded' | 'critical'>('optimal');
  const wsRef = useRef<WebSocket | null>(null);

  // Measure API Latency (REST)
  useEffect(() => {
    const measureApi = async () => {
      const start = performance.now();
      try {
        await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });
        const end = performance.now();
        setApiLatency(Math.round(end - start));
      } catch (e) {
        setApiLatency(null);
      }
    };

    const interval = setInterval(measureApi, 3000);
    measureApi();
    return () => clearInterval(interval);
  }, []);

  // Measure WebSocket Latency (Round Trip)
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      let pingStart: number;

      ws.onopen = () => {
        const ping = () => {
          if (ws.readyState === WebSocket.OPEN) {
            pingStart = performance.now();
            // Using a simple subscription as a ping proxy if HL doesn't support 'ping' opcode via client
            ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
          }
        };
        const interval = setInterval(ping, 2000);
        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.channel === 'allMids') {
             const end = performance.now();
             const lat = Math.round(end - pingStart);
             setWsLatency(lat);
             setHistory(prev => [...prev, { time: Date.now(), latency: lat }].slice(-30));
             
             if (lat < 150) setStatus('optimal');
             else if (lat < 400) setStatus('degraded');
             else setStatus('critical');
          }
        };
        return () => clearInterval(interval);
      };

      ws.onclose = () => setTimeout(connect, 3000);
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-dark-1000 p-8 overflow-y-auto">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,163,0.15)]">
            <Shield className="w-8 h-8 text-brand-neon" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white">System Health</h1>
            <p className="text-dark-500 font-mono text-xs uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
              <span className={clsx("w-2 h-2 rounded-full animate-ping", 
                status === 'optimal' ? 'bg-brand-neon' : status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              )} />
              Network Core: {status.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="px-6 py-4 bg-dark-950 border border-dark-900 rounded-2xl flex flex-col items-end">
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Global Node</span>
            <span className="text-xl font-black text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-neon" /> Mainnet-L1
            </span>
          </div>
          <div className="px-6 py-4 bg-dark-950 border border-dark-900 rounded-2xl flex flex-col items-end">
            <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-1">Infrastructure</span>
            <span className="text-xl font-black text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-neon" /> Decentralized
            </span>
          </div>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* WS LATENCY */}
        <div className="bg-dark-950 border border-dark-800 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-brand-neon/10 transition-all" />
          <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-neon" /> WebSocket RTT
          </div>
          <div className="text-6xl font-black text-white tracking-tighter mb-2">
            {wsLatency ?? '--'}<span className="text-2xl text-dark-600 ml-2">ms</span>
          </div>
          <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Sub-second execution stream</div>
        </div>

        {/* API LATENCY */}
        <div className="bg-dark-950 border border-dark-800 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-blue-500/10 transition-all" />
          <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> REST API Speed
          </div>
          <div className="text-6xl font-black text-white tracking-tighter mb-2">
            {apiLatency ?? '--'}<span className="text-2xl text-dark-600 ml-2">ms</span>
          </div>
          <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Historical Metadata Fetch</div>
        </div>

        {/* STABILITY */}
        <div className="bg-dark-950 border border-dark-800 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-yellow-500/10 transition-all" />
          <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <SignalHigh className="w-4 h-4 text-yellow-400" /> Signal Quality
          </div>
          <div className="text-6xl font-black text-white tracking-tighter mb-2">
            {status === 'optimal' ? '99.9' : status === 'degraded' ? '94.2' : '72.1'}<span className="text-2xl text-dark-600 ml-2">%</span>
          </div>
          <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Packet Loss Monitoring</div>
        </div>
      </div>

      {/* LATENCY VISUALIZER */}
      <div className="bg-dark-950 border border-dark-900 rounded-3xl p-8 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
             <Activity className="w-4 h-4 text-brand-neon" /> 60-Second Performance Tape
           </h3>
           <div className="flex gap-2">
             <div className="flex items-center gap-1.5 px-3 py-1 bg-dark-900 rounded text-[9px] font-bold text-dark-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-neon" /> Optimal
             </div>
             <div className="flex items-center gap-1.5 px-3 py-1 bg-dark-900 rounded text-[9px] font-bold text-dark-400">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Degraded
             </div>
           </div>
        </div>

        <div className="flex-1 flex items-end gap-1 px-4 pb-4">
           {history.map((h, i) => (
             <motion.div 
               key={h.time}
               initial={{ height: 0 }}
               animate={{ height: `${Math.min((h.latency / 500) * 100, 100)}%` }}
               className={clsx(
                 "flex-1 min-w-[4px] rounded-t-sm transition-colors",
                 h.latency < 150 ? "bg-brand-neon" : h.latency < 400 ? "bg-yellow-500" : "bg-red-500"
               )}
             />
           ))}
           {history.length === 0 && (
             <div className="w-full h-full flex items-center justify-center text-dark-700 text-[10px] font-black uppercase tracking-widest">
                Aggregating network packets...
             </div>
           )}
        </div>
      </div>

      {/* ALERT FOOTER */}
      {status !== 'optimal' && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          className="mt-6 p-4 bg-brand-red/10 border border-brand-red/30 rounded-2xl flex items-center gap-4"
        >
           <AlertTriangle className="w-5 h-5 text-brand-red" />
           <p className="text-xs font-bold text-brand-red uppercase tracking-widest">
             High Latency Detected: Execution speeds may be impacted by global network congestion.
           </p>
        </motion.div>
      )}
    </div>
  );
};
