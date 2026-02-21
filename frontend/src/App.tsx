import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import { ProgramYearProvider } from './contexts/ProgramYearContext'
import LandingPage from './pages/LandingPage'
import DistrictDetailPage from './pages/DistrictDetailPage'

function Layout(): React.JSX.Element {
  return (
    <>
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

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ProgramYearProvider>
        <RouterProvider router={router} />
      </ProgramYearProvider>
    </QueryClientProvider>
  )
}

export default App
