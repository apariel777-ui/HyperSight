import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/layout/Navbar';
import { MarketsPage } from './pages/MarketsPage';
import { ChartPage } from './pages/ChartPage';

import { AuctionsPage } from './pages/AuctionsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60000 },
  },
});

function AppContent() {
  const location = useLocation();
  const isChart = location.pathname === '/chart';

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans flex flex-col">
      <Navbar />
      {/* Chart page gets full height below navbar; all other pages get scrollable content */}
      <main
        style={
          isChart
            ? { height: 'calc(100vh - 64px)', marginTop: '64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : { marginTop: '64px', flex: 1 }
        }
      >
        <Routes>
          <Route path="/" element={<MarketsPage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/auctions" element={<AuctionsPage />} />
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
