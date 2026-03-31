import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportErrorRemote, type RemoteErrorReport } from '../errorTelemetry'

describe('errorTelemetry remote reporting (#254)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv(
      'VITE_TELEMETRY_ENDPOINT',
      'https://telemetry.example.com/errors'
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should POST error data to the configured endpoint', async () => {
    const error = new Error('RemoteTest')
    await reportErrorRemote(error, '  at Component\n  at App')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://telemetry.example.com/errors')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')

    const body: RemoteErrorReport = JSON.parse(options.body)
    expect(body.message).toBe('RemoteTest')
    expect(body.componentStack).toBe('  at Component\n  at App')
    expect(body.url).toBeDefined()
    expect(body.userAgent).toBeDefined()
    expect(body.timestamp).toBeDefined()
    expect(body.appVersion).toBeDefined()
  })

  it('should not send PII — only technical context', async () => {
    const error = new Error('Security check')
    await reportErrorRemote(error)

    const body: RemoteErrorReport = JSON.parse(fetchSpy.mock.calls[0]![1].body)

    // Verify it contains ONLY the expected fields
    const allowedKeys = [
      'timestamp',
      'message',
      'componentStack',
      'url',
      'userAgent',
      'appVersion',
    ]
    Object.keys(body).forEach(key => {
      expect(allowedKeys).toContain(key)
    })
  })

  it('should silently no-op when endpoint is not configured', async () => {
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', '')
    const error = new Error('No endpoint')
    await reportErrorRemote(error)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should silently no-op when VITE_ENABLE_TELEMETRY is "false"', async () => {
    vi.stubEnv('VITE_ENABLE_TELEMETRY', 'false')
    const error = new Error('Disabled')
    await reportErrorRemote(error)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should silently swallow fetch errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'))
    const error = new Error('Fetch failure')

    // Should not throw
    await expect(reportErrorRemote(error)).resolves.toBeUndefined()
  })

  it('should include componentStack as undefined when not provided', async () => {
    const error = new Error('No stack')
    await reportErrorRemote(error)

    const body: RemoteErrorReport = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.componentStack).toBeUndefined()
  })
})
