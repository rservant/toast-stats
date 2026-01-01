import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import {
  BackfillProvider,
  useBackfillContext,
} from './contexts/BackfillContext'
import { ProgramYearProvider } from './contexts/ProgramYearContext'
import { BackfillProgressBar } from './components/BackfillProgressBar'
import LandingPage from './pages/LandingPage'
import DistrictDetailPage from './pages/DistrictDetailPage'
import ReconciliationManagementPage from './pages/ReconciliationManagementPage'

function Layout() {
  const { activeBackfills, removeBackfill } = useBackfillContext()

  return (
    <>
      {/* Backfill Progress Bars - Show all active backfills */}
      {activeBackfills.map(backfillInfo => (
        <BackfillProgressBar
          key={backfillInfo.backfillId}
          backfillId={backfillInfo.backfillId}
          type={backfillInfo.type}
          districtId={backfillInfo.districtId}
          onComplete={() => removeBackfill(backfillInfo.backfillId)}
          onCancel={() => removeBackfill(backfillInfo.backfillId)}
        />
      ))}

      <a href="#main-content" className="tm-skip-link">
        Skip to main content
      </a>
      <Outlet />
    </>
  )
}

// Create router configuration (ready for v7 future flags when available)
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        {
          index: true,
          element: <LandingPage />,
        },
        {
          path: 'district/:districtId',
          element: <DistrictDetailPage />,
        },
        {
          path: 'admin/reconciliation',
          element: <ReconciliationManagementPage />,
        },
      ],
    },
  ]
  // Future flags will be added when React Router v7 is available:
  // {
  //   future: {
  //     v7_startTransition: true,
  //     v7_relativeSplatPath: true,
  //   }
  // }
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProgramYearProvider>
        <BackfillProvider>
          <RouterProvider router={router} />
        </BackfillProvider>
      </ProgramYearProvider>
    </QueryClientProvider>
  )
}

export default App
