import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'
import { config } from '../config/index.js'

interface ToastmastersAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
}

interface RequestOptions {
  skipRetry?: boolean
  skipRateLimit?: boolean
}

export class ToastmastersAPIService {
  private axiosInstance: AxiosInstance
  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private retryConfig: RetryConfig
  private lastRequestTime = 0
  private minRequestInterval = 100 // Minimum ms between requests for rate limiting

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.toastmastersDashboardUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ToastmastersDistrictVisualizer/1.0',
      },
    })

    this.retryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    }

    this.setupInterceptors()
  }

  /**
   * Set up axios interceptors for logging and token injection
   */
  private setupInterceptors(): void {
    // Request interceptor for logging and token injection
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logRequest(config)

        // Inject access token if available
        if (this.accessToken && !config.url?.includes('/auth/login')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }

        return config
      },
      (error) => {
        this.logError('Request error', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logResponse(response)
        return response
      },
      (error) => {
        this.logError('Response error', error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Authenticate with Toastmasters dashboard and obtain access token
   */
  async authenticate(username: string, password: string): Promise<boolean> {
    try {
      this.log('Authenticating with Toastmasters dashboard', { username })

      const response = await this.axiosInstance.post<ToastmastersAuthResponse>(
        '/api/auth/login',
        {
          username,
          password,
        }
      )

      this.accessToken = response.data.access_token
      this.tokenExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000
      )

      this.log('Authentication successful', {
        expiresAt: this.tokenExpiresAt,
      })

      return true
    } catch (error) {
      this.logError('Authentication failed', error)
      this.accessToken = null
      this.tokenExpiresAt = null
      throw new Error('Failed to authenticate with Toastmasters dashboard')
    }
  }

  /**
   * Check if current token is valid
   */
  isAuthenticated(): boolean {
    if (!this.accessToken || !this.tokenExpiresAt) {
      return false
    }

    // Check if token expires in less than 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    return this.tokenExpiresAt > fiveMinutesFromNow
  }

  /**
   * Make authenticated request with retry logic and rate limiting
   */
  private async makeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    // Ensure we're authenticated
    if (!this.isAuthenticated() && !url.includes('/auth/login')) {
      throw new Error('Not authenticated with Toastmasters dashboard')
    }

    // Apply rate limiting unless skipped
    if (!options.skipRateLimit) {
      await this.applyRateLimit()
    }

    // Execute request with retry logic
    if (options.skipRetry) {
      return await this.executeRequest<T>(method, url, data)
    }

    return await this.executeWithRetry<T>(method, url, data)
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown,
    attempt = 0
  ): Promise<T> {
    try {
      return await this.executeRequest<T>(method, url, data)
    } catch (error) {
      const axiosError = error as AxiosError

      // Don't retry on client errors (4xx except 429)
      if (
        axiosError.response?.status &&
        axiosError.response.status >= 400 &&
        axiosError.response.status < 500 &&
        axiosError.response.status !== 429
      ) {
        throw error
      }

      // Check if we should retry
      if (attempt >= this.retryConfig.maxRetries) {
        this.logError(
          `Max retries (${this.retryConfig.maxRetries}) reached for ${url}`,
          error
        )
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.retryConfig.initialDelayMs * Math.pow(2, attempt),
        this.retryConfig.maxDelayMs
      )

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay
      const totalDelay = delay + jitter

      this.log(`Retrying request after ${Math.round(totalDelay)}ms`, {
        url,
        attempt: attempt + 1,
        maxRetries: this.retryConfig.maxRetries,
      })

      await this.sleep(totalDelay)

      return await this.executeWithRetry<T>(method, url, data, attempt + 1)
    }
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown
  ): Promise<T> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
    }

    if (data && (method === 'post' || method === 'put')) {
      requestConfig.data = data
    }

    const response = await this.axiosInstance.request<T>(requestConfig)
    return response.data
  }

  /**
   * Apply rate limiting to prevent overwhelming the API
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest
      await this.sleep(delay)
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Transform Toastmasters API response to internal format
   * This is a generic transformer that can be extended for specific endpoints
   */
  transformResponse<T, R>(data: T, transformer: (data: T) => R): R {
    try {
      return transformer(data)
    } catch (error) {
      this.logError('Response transformation failed', error)
      throw new Error('Failed to transform API response')
    }
  }

  /**
   * Log request details
   */
  private logRequest(requestConfig: AxiosRequestConfig): void {
    if (config.nodeEnv === 'development') {
      this.log('API Request', {
        method: requestConfig.method?.toUpperCase(),
        url: requestConfig.url,
        baseURL: requestConfig.baseURL,
      })
    }
  }

  /**
   * Log response details
   */
  private logResponse(response: { status: number; config: AxiosRequestConfig }): void {
    if (config.nodeEnv === 'development') {
      this.log('API Response', {
        status: response.status,
        url: response.config.url,
      })
    }
  }

  /**
   * Log general messages
   */
  private log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [ToastmastersAPI] ${message}`, data || '')
  }

  /**
   * Log errors
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ToastmastersAPI] ERROR: ${message}`)

    if (error instanceof AxiosError) {
      console.error('  Status:', error.response?.status)
      console.error('  URL:', error.config?.url)
      console.error('  Message:', error.message)
      if (error.response?.data) {
        console.error('  Response:', error.response.data)
      }
    } else if (error instanceof Error) {
      console.error('  Message:', error.message)
      console.error('  Stack:', error.stack)
    } else {
      console.error('  Error:', error)
    }
  }

  /**
   * Public API methods for fetching data
   * These will be implemented in future tasks
   */

  async getDistricts(): Promise<unknown> {
    return await this.makeRequest('get', '/api/districts')
  }

  async getDistrictStatistics(districtId: string): Promise<unknown> {
    return await this.makeRequest('get', `/api/districts/${districtId}/statistics`)
  }

  async getMembershipHistory(
    districtId: string,
    months: number
  ): Promise<unknown> {
    return await this.makeRequest(
      'get',
      `/api/districts/${districtId}/membership-history?months=${months}`
    )
  }

  async getClubs(districtId: string): Promise<unknown> {
    return await this.makeRequest('get', `/api/districts/${districtId}/clubs`)
  }

  async getDailyReports(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<unknown> {
    return await this.makeRequest(
      'get',
      `/api/districts/${districtId}/daily-reports?startDate=${startDate}&endDate=${endDate}`
    )
  }

  async getDailyReportDetail(
    districtId: string,
    date: string
  ): Promise<unknown> {
    return await this.makeRequest(
      'get',
      `/api/districts/${districtId}/daily-reports/${date}`
    )
  }

  async getEducationalAwards(
    districtId: string,
    months: number
  ): Promise<unknown> {
    return await this.makeRequest(
      'get',
      `/api/districts/${districtId}/educational-awards?months=${months}`
    )
  }
}
