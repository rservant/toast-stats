import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Flag to indicate if we should bypass cache on next requests
let bypassCache = false

/**
 * Enable cache bypass for the next set of requests
 */
export const enableCacheBypass = () => {
  bypassCache = true
}

/**
 * Disable cache bypass
 */
export const disableCacheBypass = () => {
  bypassCache = false
}

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add cache bypass parameter
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add cache bypass parameter if enabled
    if (bypassCache && config.method === 'get') {
      config.params = {
        ...config.params,
        refresh: 'true',
      }
    }

    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => {
    return response
  },
  (error: AxiosError) => {
    // Just pass through errors without auth logic
    return Promise.reject(error)
  }
)
