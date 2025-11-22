import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { BackfillProvider, useBackfillContext } from './contexts/BackfillContext';
import { BackfillProgressBar } from './components/BackfillProgressBar';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import DistrictDetailPage from './pages/DistrictDetailPage';

function AppContent() {
  const { activeBackfillInfo, setActiveBackfillInfo } = useBackfillContext();

  return (
    <>
      {/* Global Backfill Progress Bar */}
      {activeBackfillInfo && (
        <BackfillProgressBar
          backfillId={activeBackfillInfo.backfillId}
          type={activeBackfillInfo.type}
          districtId={activeBackfillInfo.districtId}
          onComplete={() => setActiveBackfillInfo(null)}
          onCancel={() => setActiveBackfillInfo(null)}
        />
      )}
      
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/district/:districtId" element={<DashboardPage />} />
          <Route path="/district/:districtId/detail" element={<DistrictDetailPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BackfillProvider>
        <AppContent />
      </BackfillProvider>
    </QueryClientProvider>
  );
}

export default App;
