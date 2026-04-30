import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMarkets } from '../../api/hyperliquid';
import { useStore } from '../../store';
import { ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { AssetLogo } from '../common/AssetLogo';
import clsx from 'clsx';

export const MarketsTable = () => {
  const navigate = useNavigate();
  const setSelectedMarket = useStore((state) => state.setSelectedMarket);
  const selectedCategory = useStore((state) => state.selectedCategory);
  const setSelectedCategory = useStore((state) => state.setSelectedCategory);
  
  const [search, setSearch] = useState('');

  const { data: markets, isLoading, isError } = useQuery({
    queryKey: ['markets', selectedCategory],
    queryFn: () => fetchMarkets(selectedCategory),
    refetchInterval: 3000, 
  });

  const categories = ['Crypto', 'Stocks', 'Indices', 'Commodities'] as const;

  const handleRowClick = (marketName: string) => {
    setSelectedMarket(marketName);
    navigate('/chart');
  };

  const filteredMarkets = (markets || []) as any[];
  const results = filteredMarkets.filter((m: any) => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-dark-800 rounded-lg w-full"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <div className="text-brand-red p-4 border border-brand-red/20 rounded-lg bg-brand-red/5">Failed to load markets</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-dark-900/30 p-2 rounded-xl border border-dark-800/50">
        <div className="flex gap-1 p-1 bg-dark-1000/50 rounded-lg overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                "px-4 py-2 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap",
                selectedCategory === cat 
                  ? "bg-dark-800 text-brand-neon border border-brand-neon/20 shadow-[0_0_10px_rgba(0,255,163,0.1)]"
                  : "text-dark-500 hover:text-white hover:bg-dark-800/30"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-dark-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-dark-800 rounded-lg bg-dark-1000 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-brand-neon"
            placeholder={`Search ${selectedCategory}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-dark-700/50 bg-dark-800/20">
        <table className="min-w-full divide-y divide-dark-700/50">
          <thead className="bg-dark-800/80">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Asset</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">Price</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">24h Change</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">24h Vol</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">Open Interest</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">Funding</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/30">
            {results.map((market: any) => (
              <tr 
                key={market.name} 
                className="hover:bg-dark-700/30 transition-colors cursor-pointer group"
                onClick={() => handleRowClick(market.name)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <AssetLogo symbol={market.name} size="md" />
                    <div className="ml-4">
                      <div className="text-sm font-bold text-white">{market.name}</div>
                      <div className="text-xs text-dark-400">
                        {selectedCategory === 'Crypto' ? 'Perpetual' : 
                         selectedCategory === 'Stocks' ? 'Equity' : 
                         selectedCategory === 'Indices' ? 'Index' : 'Commodity'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className="text-sm text-white">${market.markPx.toFixed(4)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className={clsx("text-sm flex items-center justify-end gap-1", market.change24h >= 0 ? "text-brand-neon" : "text-brand-red")}>
                    {market.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(market.change24h).toFixed(2)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className="text-sm text-white">${(market.volume24h / 1000000).toFixed(2)}M</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className="text-sm text-dark-200">{market.openInterest.toFixed(2)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className={clsx("text-sm", market.fundingRate > 0 ? "text-brand-neon" : "text-brand-red")}>
                    {market.fundingRate.toFixed(4)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-dark-700 hover:bg-brand-neon hover:text-dark-900 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(market.name);
                    }}
                  >
                    Trade
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
