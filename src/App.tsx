import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/layout/Navbar';
import { MarketsPage } from './pages/MarketsPage';
import { ChartPage } from './pages/ChartPage';

import { AuctionsPage } from './pages/AuctionsPage';
import { TrackPage } from './pages/TrackPage';
import { LimitOrderPage } from './pages/LimitOrderPage';
import { TokenPage } from './pages/TokenPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60000 },
  },
});

function AppContent() {
  const location = useLocation();
  const isFixedLayout = location.pathname === '/chart' || 
                        location.pathname === '/track' || 
                        location.pathname === '/walls' ||
                        location.pathname.startsWith('/token/');

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans flex flex-col">
      <Navbar />
      {/* Chart and Track pages get full height below navbar; all other pages get scrollable content */}
      <main
        style={
          isFixedLayout
            ? { height: 'calc(100vh - 64px)', marginTop: '64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : { marginTop: '64px', flex: 1 }
        }
      >
        <Routes>
          <Route path="/" element={<MarketsPage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/auctions" element={<AuctionsPage />} />
          <Route path="/track" element={<TrackPage />} />
          <Route path="/walls" element={<LimitOrderPage />} />
          <Route path="/token/:symbol" element={<TokenPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
