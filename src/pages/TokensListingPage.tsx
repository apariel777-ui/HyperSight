import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  ExternalLink,
  Coins
} from 'lucide-react';
import { fetchMarkets, fetchSpotMeta } from '../api/hyperliquid';
import { AssetLogo } from '../components/common/AssetLogo';
import clsx from 'clsx';

export const TokensListingPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'Perp' | 'Spot'>('Spot');

  const { data: perps } = useQuery({
    queryKey: ['markets', 'Crypto'],
    queryFn: () => fetchMarkets('Crypto'),
    refetchInterval: 5000
  });

  const { data: spot } = useQuery({
    queryKey: ['spotMeta'],
    queryFn: fetchSpotMeta
  });

  const spotTokens = (spot?.tokens || []).map((t: any) => ({
    name: t.name,
    markPx: 0, // Spot price requires a different request, using 0 for listing
    change24h: 0,
    volume24h: 0,
    isSpot: true,
    index: t.index
  }));

  const allTokens = activeTab === 'Perp' ? (perps || []) : spotTokens;
  const filtered = allTokens.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-8 space-y-8 max-w-[1400px] mx-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-brand-neon" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Token Explorer</h1>
          </div>
          <p className="text-dark-400 text-xs font-mono uppercase tracking-[0.2em] font-black">
            Full directory of assets deployed on Hyperliquid L1
          </p>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input 
              type="text"
              placeholder="Search ticker or name..."
              className="w-full bg-dark-950 border border-dark-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-neon transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-dark-900 pb-0.5">
        {(['Spot', 'Perp'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative",
              activeTab === tab ? "text-brand-neon" : "text-dark-600 hover:text-white"
            )}
          >
            {tab} Native
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-neon shadow-[0_0_15px_rgba(0,255,163,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-dark-950/50 rounded-2xl border border-dark-900 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-1000/50 border-b border-dark-900">
              <th className="p-6 text-[10px] font-black uppercase text-dark-500 tracking-widest">Asset</th>
              <th className="p-6 text-[10px] font-black uppercase text-dark-500 tracking-widest text-right">Price</th>
              <th className="p-6 text-[10px] font-black uppercase text-dark-500 tracking-widest text-right">24h Change</th>
              <th className="p-6 text-[10px] font-black uppercase text-dark-500 tracking-widest text-right">Market</th>
              <th className="p-6 text-[10px] font-black uppercase text-dark-500 tracking-widest text-right">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-900/50">
            {filtered.map((token: any) => (
              <tr key={token.name} className="hover:bg-dark-900/30 transition-colors group">
                <td className="p-6 whitespace-nowrap">
                  <Link to={`/token/${token.name}`} className="flex items-center gap-4">
                    <AssetLogo symbol={token.name} size="md" />
                    <div>
                      <div className="text-base font-black text-white group-hover:text-brand-neon transition-colors uppercase tracking-tight">
                        {token.name}
                      </div>
                      <div className="text-[9px] text-dark-500 uppercase font-bold tracking-widest">
                        {activeTab} Asset
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="p-6 text-right font-mono text-sm font-black text-white">
                  {token.markPx > 0 ? `$${token.markPx.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}
                </td>
                <td className="p-6 text-right">
                  {token.change24h !== 0 ? (
                    <div className={clsx("flex items-center justify-end gap-1 text-sm font-black font-mono", token.change24h >= 0 ? "text-brand-neon" : "text-brand-red")}>
                      {token.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(token.change24h).toFixed(2)}%
                    </div>
                  ) : (
                    <span className="text-dark-600 font-mono text-sm">---</span>
                  )}
                </td>
                <td className="p-6 text-right">
                  <span className="px-3 py-1 rounded-full bg-dark-900 text-dark-400 text-[9px] font-black uppercase tracking-widest border border-dark-800">
                    {activeTab} Trading
                  </span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex justify-end gap-3">
                    <Link 
                      to={`/token/${token.name}`}
                      className="px-4 py-2 bg-brand-neon text-dark-1000 text-[10px] font-black rounded-lg uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,255,163,0.3)] transition-all"
                    >
                      Profile
                    </Link>
                    <a 
                      href={`https://hypurrscan.io/?search=${token.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-dark-900 text-dark-400 hover:text-white rounded-lg border border-dark-800 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center">
            <Activity className="w-12 h-12 text-dark-800 mb-4 animate-pulse" />
            <h3 className="text-xl font-black text-dark-500 uppercase tracking-tighter">No assets found</h3>
            <p className="text-[10px] text-dark-600 uppercase tracking-widest mt-2">Try a different search query or category</p>
          </div>
        )}
      </div>
    </div>
  );
};
