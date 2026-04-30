import { MarketsTable } from '../components/markets/MarketsTable';

export const MarketsPage = () => {
  return (
    <div className="pt-8 px-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-dark-400">Markets Overview</h1>
          <p className="text-dark-400 mt-2">Trade perpetual futures with deep liquidity and zero gas fees.</p>
        </div>
        <div className="flex gap-4">
          <div className="p-4 glass-panel flex flex-col items-end">
            <span className="text-xs text-dark-400 uppercase font-bold">24h Volume</span>
            <span className="text-lg font-mono text-white">$1.24B</span>
          </div>
          <div className="p-4 glass-panel flex flex-col items-end">
            <span className="text-xs text-dark-400 uppercase font-bold">Total Markets</span>
            <span className="text-lg font-mono text-brand-neon">140+</span>
          </div>
        </div>
      </div>
      <div className="glass-panel p-1 border-t-brand-neon/20 border-t-2">
        <MarketsTable />
      </div>
    </div>
  );
};
