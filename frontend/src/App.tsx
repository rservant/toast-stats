import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { BackfillProvider, useBackfillContext } from './contexts/BackfillContext';
import { BackfillProgressBar } from './components/BackfillProgressBar';
import LandingPage from './pages/LandingPage';
import DistrictDetailPage from './pages/DistrictDetailPage';

function AppContent() {
  const { activeBackfills, removeBackfill } = useBackfillContext();

  return (
    <>
      {/* Backfill Progress Bars - Show all active backfills */}
      {activeBackfills.map((backfillInfo) => (
        <BackfillProgressBar
          key={backfillInfo.backfillId}
          backfillId={backfillInfo.backfillId}
          type={backfillInfo.type}
          districtId={backfillInfo.districtId}
          onComplete={() => removeBackfill(backfillInfo.backfillId)}
          onCancel={() => removeBackfill(backfillInfo.backfillId)}
        />
      ))}
      
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/district/:districtId" element={<DistrictDetailPage />} />
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
