import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { BackfillProvider, useBackfillContext } from './contexts/BackfillContext';
import { BackfillProgressBar } from './components/BackfillProgressBar';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';

function AppContent() {
  const { activeBackfillId, setActiveBackfillId } = useBackfillContext();

  return (
    <>
      {/* Global Backfill Progress Bar */}
      {activeBackfillId && (
        <BackfillProgressBar
          backfillId={activeBackfillId}
          onComplete={() => setActiveBackfillId(null)}
          onCancel={() => setActiveBackfillId(null)}
        />
      )}
      
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/district/:districtId" element={<DashboardPage />} />
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
