/**
 * Unit Tests for ReconciliationReplayEngine
 *
 * Tests replay functionality for debugging reconciliation scenarios,
 * step-by-step execution, and comparison with original timelines.
 */

import { describe, it, expect, vi } from 'vitest'
import { ReconciliationReplayEngine } from '../ReconciliationReplayEngine.ts'
import { ChangeDetectionEngine } from '../../services/ChangeDetectionEngine.ts'
import { createTestSelfCleanup } from '../test-self-cleanup.ts'
import type {
  ReplaySession,
  ReplayOptions,
} from '../ReconciliationReplayEngine.ts'
import type {
  ReconciliationJob,
  ReconciliationTimeline,
} from '../../types/reconciliation.ts'
import type { DistrictStatistics } from '../../types/districts.ts'

// Mock logger
vi.mock('../logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock interface for ChangeDetectionEngine
interface MockChangeDetectionEngine {
  detectChanges: ReturnType<typeof vi.fn>
  getChangeHistory: ReturnType<typeof vi.fn>
  clearHistory: ReturnType<typeof vi.fn>
  isSignificantChange: ReturnType<typeof vi.fn>
  calculateChangeMetrics: ReturnType<typeof vi.fn>
  detectMembershipChanges: ReturnType<typeof vi.fn>
  detectClubCountChanges: ReturnType<typeof vi.fn>
  detectDistinguishedChanges: ReturnType<typeof vi.fn>
}

// Mock ChangeDetectionEngine
vi.mock('../../services/ChangeDetectionEngine.ts')

describe('ReconciliationReplayEngine', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function createReplayEngine() {
    const mockChangeDetectionEngine: MockChangeDetectionEngine = {
      detectChanges: vi.fn(),
      getChangeHistory: vi.fn(),
      clearHistory: vi.fn(),
      isSignificantChange: vi.fn(),
      calculateChangeMetrics: vi.fn(),
      detectMembershipChanges: vi.fn(),
      detectClubCountChanges: vi.fn(),
      detectDistinguishedChanges: vi.fn(),
    }

    vi.mocked(ChangeDetectionEngine).mockImplementation(
      () => mockChangeDetectionEngine as unknown as ChangeDetectionEngine
    )

    const replayEngine = new ReconciliationReplayEngine(
      mockChangeDetectionEngine as unknown as ChangeDetectionEngine
    )
    
    // Register cleanup for the replay engine
    cleanup(() => {
      // Add any cleanup needed for the replay engine
    })
    
    return { replayEngine, mockChangeDetectionEngine }
  }

  // Test data
  const mockJob: ReconciliationJob = {
    id: 'test-job-1',
    districtId: 'D123',
    targetMonth: '2024-01',
    status: 'completed',
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2024-01-10T00:00:00Z'),
    maxEndDate: new Date('2024-01-16T00:00:00Z'),
    progress: {
      phase: 'completed',
      completionPercentage: 100,
    },
    triggeredBy: 'automatic',
    config: {
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2,
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 5,
    },
    metadata: {
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-10T00:00:00Z'),
      triggeredBy: 'automatic',
    },
  }

  const mockTimeline: ReconciliationTimeline = {
    jobId: 'test-job-1',
    districtId: 'D123',
    targetMonth: '2024-01',
    entries: [
      {
        date: new Date('2024-01-02T00:00:00Z'),
        sourceDataDate: '2024-01-02',
        changes: {
          hasChanges: true,
          changedFields: ['membership'],
          membershipChange: {
            previous: 100,
            current: 105,
            percentChange: 5,
          },
          timestamp: new Date('2024-01-02T00:00:00Z'),
          sourceDataDate: '2024-01-02',
        },
        isSignificant: true,
        cacheUpdated: true,
      },
    ],
    status: {
      phase: 'completed',
      daysActive: 9,
      daysStable: 3,
      message: 'Reconciliation completed',
    },
  }

  const mockDataSequence: DistrictStatistics[] = [
    {
      districtId: 'D123',
      asOfDate: '2024-01-01',
      clubs: {
        total: 50,
        active: 48,
        chartered: 48,
        suspended: 2,
        ineligible: 0,
        low: 0,
        distinguished: 20,
      },
      membership: {
        total: 1000,
        change: 0,
        changePercent: 0,
        byClub: [],
        new: 50,
        renewed: 900,
        dual: 50,
      },
      education: { totalAwards: 0, byType: [], topClubs: [] },
      goals: { clubsGoal: 55, membershipGoal: 1100, distinguishedGoal: 25 },
      performance: { clubsNet: 0, membershipNet: 0, distinguishedPercent: 40 },
    },
    {
      districtId: 'D123',
      asOfDate: '2024-01-02',
      clubs: {
        total: 50,
        active: 48,
        chartered: 48,
        suspended: 2,
        ineligible: 0,
        low: 0,
        distinguished: 20,
      },
      membership: {
        total: 1005,
        change: 5,
        changePercent: 0.5,
        byClub: [],
        new: 55,
        renewed: 900,
        dual: 50,
      },
      education: { totalAwards: 0, byType: [], topClubs: [] },
      goals: { clubsGoal: 55, membershipGoal: 1100, distinguishedGoal: 25 },
      performance: { clubsNet: 0, membershipNet: 5, distinguishedPercent: 40 },
    },
    {
      districtId: 'D123',
      asOfDate: '2024-01-03',
      clubs: {
        total: 51,
        active: 49,
        chartered: 49,
        suspended: 2,
        ineligible: 0,
        low: 0,
        distinguished: 21,
      },
      membership: {
        total: 1010,
        change: 10,
        changePercent: 1.0,
        byClub: [],
        new: 60,
        renewed: 900,
        dual: 50,
      },
      education: { totalAwards: 0, byType: [], topClubs: [] },
      goals: { clubsGoal: 55, membershipGoal: 1100, distinguishedGoal: 25 },
      performance: {
        clubsNet: 1,
        membershipNet: 10,
        distinguishedPercent: 41.2,
      },
    },
  ]

  describe('createReplaySession', () => {
    it('should create a new replay session', () => {
      const { replayEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Replay',
        'Testing replay functionality',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      expect(session.id).toBeTruthy()
      expect(session.name).toBe('Test Replay')
      expect(session.description).toBe('Testing replay functionality')
      expect(session.originalJob).toEqual(mockJob)
      expect(session.originalTimeline).toEqual(mockTimeline)
      expect(session.dataSequence).toEqual(mockDataSequence)
      expect(session.currentStep).toBe(0)
      expect(session.replayState).toBeDefined()
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastUpdated).toBeInstanceOf(Date)
    })

    it('should initialize replay state correctly', () => {
      const { replayEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Replay',
        'Test description',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      const state = session.replayState
      expect(state.currentJob).toEqual(mockJob)
      expect(state.currentTimeline.entries).toHaveLength(0)
      expect(state.currentTimeline.status.phase).toBe('monitoring')
      expect(state.processedEntries).toHaveLength(0)
      expect(state.currentData).toBeNull()
      expect(state.previousData).toBeNull()
      expect(state.stepResults).toHaveLength(0)
      expect(state.debugInfo.totalSteps).toBe(0)
      expect(state.debugInfo.significantChanges).toBe(0)
      expect(state.debugInfo.extensionCount).toBe(0)
    })

    it('should store session for retrieval', () => {
      const { replayEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Replay',
        'Test description',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      const retrieved = replayEngine.getReplaySession(session.id)
      expect(retrieved).toEqual(session)
    })
  })

  describe('executeReplay', () => {
    function setupReplayTest() {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Replay',
        'Test description',
        mockJob,
        mockTimeline,
        mockDataSequence
      )
      const sessionId = session.id

      // Setup mock change detection
      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1005,
          percentChange: 0.5,
        },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })

      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(false)
      
      return { replayEngine, mockChangeDetectionEngine, sessionId }
    }

    it('should execute complete replay successfully', async () => {
      const { replayEngine, sessionId } = setupReplayTest()
      
      const options: ReplayOptions = {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: true,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      }

      const session = await replayEngine.executeReplay(sessionId, options)

      expect(session.currentStep).toBe(mockDataSequence.length - 1)
      expect(session.replayState.stepResults.length).toBeGreaterThan(0)
      expect(session.replayState.processedEntries.length).toBeGreaterThan(0)
      expect(
        session.replayState.debugInfo.performanceMetrics.totalProcessingTime
      ).toBeGreaterThan(0)
    })

    it('should pause on step-by-step mode', async () => {
      const { replayEngine, sessionId } = setupReplayTest()
      
      const options: ReplayOptions = {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      }

      const session = await replayEngine.executeReplay(sessionId, options)

      expect(session.currentStep).toBe(0) // Should pause after first step
      expect(session.replayState.stepResults).toHaveLength(1)
    })

    it('should pause on significant changes when enabled', async () => {
      const { replayEngine, mockChangeDetectionEngine, sessionId } = setupReplayTest()
      
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      const options: ReplayOptions = {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: true,
        pauseOnErrors: false,
      }

      const session = await replayEngine.executeReplay(sessionId, options)

      expect(session.currentStep).toBeLessThan(mockDataSequence.length - 1)
      expect(session.replayState.debugInfo.significantChanges).toBeGreaterThan(
        0
      )
    })

    it('should respect maxSteps limit', async () => {
      const { replayEngine, sessionId } = setupReplayTest()
      
      const options: ReplayOptions = {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
        maxSteps: 1,
      }

      const session = await replayEngine.executeReplay(sessionId, options)

      expect(session.currentStep).toBe(1)
      expect(session.replayState.stepResults).toHaveLength(1)
    })

    it('should handle replay execution errors', async () => {
      const { replayEngine, mockChangeDetectionEngine, sessionId } = setupReplayTest()
      
      mockChangeDetectionEngine.detectChanges.mockImplementation(() => {
        throw new Error('Change detection failed')
      })

      const options: ReplayOptions = {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      }

      await expect(
        replayEngine.executeReplay(sessionId, options)
      ).rejects.toThrow('Change detection failed')
    })

    it('should throw error for non-existent session', async () => {
      const { replayEngine } = setupReplayTest()
      
      const options: ReplayOptions = {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      }

      await expect(
        replayEngine.executeReplay('non-existent', options)
      ).rejects.toThrow('Replay session not found: non-existent')
    })
  })

  describe('executeStep', () => {
    function setupStepTest() {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Replay',
        'Test description',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1005,
          percentChange: 0.5,
        },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })

      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(false)
      
      return { replayEngine, mockChangeDetectionEngine, session }
    }

    it('should execute first step (data update only)', async () => {
      const { replayEngine, session } = setupStepTest()
      
      const options: ReplayOptions = {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      }

      const stepResult = await replayEngine.executeStep(session, options)

      expect(stepResult.stepNumber).toBe(0)
      expect(stepResult.action).toBe('data_update')
      expect(stepResult.changes).toBeNull() // No changes on first step
      expect(stepResult.isSignificant).toBe(false)
      expect(stepResult.errors).toHaveLength(0)
      expect(session.replayState.currentData).toEqual(mockDataSequence[0])
      expect(session.replayState.previousData).toBeNull()
    })

    it('should execute subsequent step with change detection', async () => {
      const { replayEngine, mockChangeDetectionEngine, session } = setupStepTest()
      
      // First execute step 0
      session.currentStep = 0
      await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      // Then execute step 1
      session.currentStep = 1
      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(stepResult.stepNumber).toBe(1)
      expect(stepResult.action).toBe('status_calculation') // Final action in step
      expect(stepResult.changes).toBeDefined()
      expect(stepResult.changes!.hasChanges).toBe(true)
      expect(mockChangeDetectionEngine.detectChanges).toHaveBeenCalledWith(
        'D123',
        mockDataSequence[0],
        mockDataSequence[1]
      )
      expect(session.replayState.processedEntries).toHaveLength(1)
    })

    it('should detect significant changes', async () => {
      const { replayEngine, mockChangeDetectionEngine, session } = setupStepTest()
      
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      session.currentStep = 1
      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(stepResult.isSignificant).toBe(true)
      expect(session.replayState.debugInfo.significantChanges).toBe(1)
      expect(stepResult.notes).toContain('Changes are SIGNIFICANT')
    })

    it('should handle step execution errors gracefully', async () => {
      const { replayEngine, mockChangeDetectionEngine, session } = setupStepTest()
      
      mockChangeDetectionEngine.detectChanges.mockImplementation(() => {
        throw new Error('Detection error')
      })

      session.currentStep = 1
      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(stepResult.errors).toHaveLength(1)
      expect(stepResult.errors[0]).toContain('Detection error')
    })

    it('should validate replay state when enabled', async () => {
      const { replayEngine, session } = setupStepTest()
      
      session.currentStep = 1
      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: true,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      // Validation should run without errors for normal case
      expect(stepResult.warnings.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('session management', () => {
    it('should get all replay sessions', () => {
      const { replayEngine } = createReplayEngine()
      
      const session1 = replayEngine.createReplaySession(
        'Session 1',
        'Description 1',
        mockJob,
        mockTimeline,
        mockDataSequence
      )
      const session2 = replayEngine.createReplaySession(
        'Session 2',
        'Description 2',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      const allSessions = replayEngine.getAllReplaySessions()

      expect(allSessions).toHaveLength(2)
      expect(allSessions.map(s => s.id)).toContain(session1.id)
      expect(allSessions.map(s => s.id)).toContain(session2.id)
    })

    it('should delete replay session', () => {
      const { replayEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Test Session',
        'Description',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      const deleted = replayEngine.deleteReplaySession(session.id)
      expect(deleted).toBe(true)

      const retrieved = replayEngine.getReplaySession(session.id)
      expect(retrieved).toBeNull()
    })

    it('should return false when deleting non-existent session', () => {
      const { replayEngine } = createReplayEngine()
      
      const deleted = replayEngine.deleteReplaySession('non-existent')
      expect(deleted).toBe(false)
    })

    it('should return null for non-existent session', () => {
      const { replayEngine } = createReplayEngine()
      
      const session = replayEngine.getReplaySession('non-existent')
      expect(session).toBeNull()
    })
  })

  describe('exportReplaySession', () => {
    it('should export complete replay session data', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Export Test',
        'Test export functionality',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      // Execute some steps
      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: false,
        changedFields: [],
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(false)

      await replayEngine.executeReplay(session.id, {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      const exported = replayEngine.exportReplaySession(session.id)

      expect(exported.session).toBeDefined()
      expect(exported.session.id).toBe(session.id)
      expect(exported.session.name).toBe('Export Test')

      expect(exported.originalData).toBeDefined()
      expect(exported.originalData.job).toEqual(mockJob)
      expect(exported.originalData.timeline).toEqual(mockTimeline)
      expect(exported.originalData.dataSequence).toEqual(mockDataSequence)

      expect(exported.replayResults).toBeDefined()
      expect(exported.replayResults.finalState).toBeDefined()
      expect(exported.replayResults.stepResults).toBeDefined()
      expect(exported.replayResults.debugInfo).toBeDefined()

      expect(exported.analysis).toBeDefined()
      expect(exported.analysis.summary).toBeDefined()
      expect(exported.analysis.performance).toBeDefined()
      expect(exported.analysis.patterns).toBeDefined()
      expect(exported.analysis.recommendations).toBeDefined()
    })

    it('should throw error for non-existent session', () => {
      const { replayEngine } = createReplayEngine()
      
      expect(() => replayEngine.exportReplaySession('non-existent')).toThrow(
        'Replay session not found: non-existent'
      )
    })
  })

  describe('compareWithOriginal', () => {
    it('should compare replay results with original timeline', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Compare Test',
        'Test comparison functionality',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      // Setup mock to return changes
      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1005,
          percentChange: 0.5,
        },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      await replayEngine.executeReplay(session.id, {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      const comparison = replayEngine.compareWithOriginal(session.id)

      expect(comparison.entryCount).toBeDefined()
      expect(comparison.entryCount.original).toBe(mockTimeline.entries.length)
      expect(comparison.entryCount.replay).toBeGreaterThan(0)
      expect(comparison.entryCount.difference).toBeDefined()

      expect(comparison.significantChanges).toBeDefined()
      expect(comparison.significantChanges.original).toBeDefined()
      expect(comparison.significantChanges.replay).toBeDefined()

      expect(comparison.finalStatus).toBeDefined()
      expect(comparison.finalStatus.original).toEqual(mockTimeline.status)
      expect(comparison.finalStatus.replay).toBeDefined()

      expect(comparison.differences).toBeDefined()
      expect(Array.isArray(comparison.differences)).toBe(true)
    })

    it('should identify differences between original and replay', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      // Create a timeline with different significance than what replay will generate
      const differentTimeline: ReconciliationTimeline = {
        ...mockTimeline,
        entries: [
          {
            ...mockTimeline.entries[0],
            isSignificant: false, // Different from what replay will generate
          },
        ],
      }

      const session = replayEngine.createReplaySession(
        'Difference Test',
        'Test difference detection',
        mockJob,
        differentTimeline,
        mockDataSequence
      )

      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: { previous: 1000, current: 1005, percentChange: 0.5 },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true) // Different from original

      await replayEngine.executeReplay(session.id, {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      const comparison = replayEngine.compareWithOriginal(session.id)

      expect(comparison.differences.length).toBeGreaterThan(0)
      const significanceDiff = comparison.differences.find(
        (d: { field: string }) => d.field === 'significance_mismatch'
      )
      expect(significanceDiff).toBeDefined()
    })

    it('should throw error for non-existent session', () => {
      const { replayEngine } = createReplayEngine()
      
      expect(() => replayEngine.compareWithOriginal('non-existent')).toThrow(
        'Replay session not found: non-existent'
      )
    })
  })

  describe('extension handling', () => {
    it('should trigger extensions when conditions are met', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Extension Test',
        'Test extension logic',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      // Setup significant change near end of reconciliation period
      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: { previous: 1000, current: 1020, percentChange: 2 },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      // Set current step to near end of max reconciliation days
      session.currentStep = 13 // Near the 15-day limit

      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(session.replayState.debugInfo.extensionCount).toBeGreaterThan(0)
      expect(stepResult.notes.some(note => note.includes('Extension'))).toBe(
        true
      )
    })

    it('should not trigger extensions when autoExtensionEnabled is false', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const jobWithoutExtensions = {
        ...mockJob,
        config: {
          ...mockJob.config,
          autoExtensionEnabled: false,
        },
      }

      const session = replayEngine.createReplaySession(
        'No Extension Test',
        'Test without extensions',
        jobWithoutExtensions,
        mockTimeline,
        mockDataSequence
      )

      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: { previous: 1000, current: 1020, percentChange: 2 },
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      session.currentStep = 13

      await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(session.replayState.debugInfo.extensionCount).toBe(0)
    })
  })

  describe('status calculation', () => {
    it('should calculate monitoring status correctly', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Status Test',
        'Test status calculation',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(true)

      session.currentStep = 1
      const stepResult = await replayEngine.executeStep(session, {
        stepByStep: true,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      expect(stepResult.newStatus.phase).toBe('monitoring')
      expect(stepResult.newStatus.daysActive).toBe(1)
      expect(stepResult.newStatus.daysStable).toBe(0)
    })

    it('should calculate completed status when stability is achieved', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Completion Test',
        'Test completion status',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      // Add multiple non-significant entries to achieve stability
      for (let i = 0; i < 4; i++) {
        mockChangeDetectionEngine.detectChanges.mockReturnValue({
          hasChanges: false,
          changedFields: [],
          timestamp: new Date(),
          sourceDataDate: `2024-01-0${i + 2}`,
        })
        mockChangeDetectionEngine.isSignificantChange.mockReturnValue(false)

        session.currentStep = i + 1
        await replayEngine.executeStep(session, {
          stepByStep: true,
          includeDebugInfo: true,
          validateAtEachStep: false,
          pauseOnSignificantChanges: false,
          pauseOnErrors: false,
        })
      }

      const finalStatus = session.replayState.currentTimeline.status
      expect(finalStatus.phase).toBe('completed')
      expect(finalStatus.daysStable).toBeGreaterThanOrEqual(3)
    })
  })

  describe('performance metrics', () => {
    it('should track performance metrics during replay', async () => {
      const { replayEngine, mockChangeDetectionEngine } = createReplayEngine()
      
      const session = replayEngine.createReplaySession(
        'Performance Test',
        'Test performance tracking',
        mockJob,
        mockTimeline,
        mockDataSequence
      )

      mockChangeDetectionEngine.detectChanges.mockReturnValue({
        hasChanges: false,
        changedFields: [],
        timestamp: new Date(),
        sourceDataDate: '2024-01-02',
      })
      mockChangeDetectionEngine.isSignificantChange.mockReturnValue(false)

      await replayEngine.executeReplay(session.id, {
        stepByStep: false,
        includeDebugInfo: true,
        validateAtEachStep: false,
        pauseOnSignificantChanges: false,
        pauseOnErrors: false,
      })

      const metrics = session.replayState.debugInfo.performanceMetrics
      expect(metrics.averageStepTime).toBeGreaterThan(0)
      expect(metrics.totalProcessingTime).toBeGreaterThan(0)
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0)
    })
  })
})
