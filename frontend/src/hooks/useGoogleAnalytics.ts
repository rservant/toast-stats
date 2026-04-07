/**
 * Google Analytics page view tracking for React Router SPA navigation (#314).
 *
 * The gtag config in index.html only fires on initial page load. For SPA
 * route changes, we need to manually send page_view events on each
 * navigation.
 *
 * Privacy:
 * - Only active on production hostname (gtag is conditionally loaded)
 * - IP anonymization enabled at config time
 * - No PII collected — page paths only
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function useGoogleAnalytics(): void {
  const location = useLocation()

  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])
}
