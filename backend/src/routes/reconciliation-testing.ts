/**
 * API Routes for Reconciliation Testing and Simulation Tools
 *
 * Provides REST endpoints for accessing reconciliation simulation,
 * test data generation, and replay capabilities.
 */

import { Router } from 'express'
import { logger } from '../utils/logger.js'
import { ReconciliationSimulator } from '../utils/ReconciliationSimulator.js'
import { ReconciliationTestDataGenerator } from '../utils/ReconciliationTestDataGenerator.js'
import { ReconciliationReplayEngine } from '../utils/ReconciliationReplayEngine.js'
import type { Request, Response } from 'express'
import type { SimulationScenario } from '../utils/ReconciliationSimulator.js'
import type { ReplayOptions } from '../utils/ReconciliationReplayEngine.js'

const router = Router()

// Initialize services
const simulator = new ReconciliationSimulator()
const testDataGenerator = new ReconciliationTestDataGenerator()
const replayEngine = new ReconciliationReplayEngine()

/**
 * GET /api/reconciliation-testing/scenarios
 * Get all available simulation scenarios
 */
router.get('/scenarios', async (_req: Request, res: Response) => {
  try {
    const scenarios = simulator.getAvailableScenarios()

    res.json({
      success: true,
      data: {
        scenarios: scenarios.map(scenario => ({
          name: scenario.name,
          description: scenario.description,
          districtId: scenario.districtId,
          targetMonth: scenario.targetMonth,
          expectedOutcome: scenario.expectedOutcome,
          expectedDuration: scenario.expectedDuration,
          dataPattern: scenario.dataPattern,
        })),
        count: scenarios.length,
      },
    })
  } catch (error) {
    logger.error('Failed to get simulation scenarios', { error })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve simulation scenarios',
    })
  }
})

/**
 * POST /api/reconciliation-testing/scenarios
 * Create a custom simulation scenario
 */
router.post('/scenarios', async (_req: Request, res: Response) => {
  try {
    const scenario: SimulationScenario = _req.body

    // Validate required fields
    if (
      !scenario.name ||
      !scenario.description ||
      !scenario.districtId ||
      !scenario.targetMonth
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required scenario fields: name, description, districtId, targetMonth',
      })
    }

    simulator.createScenario(scenario)

    logger.info('Custom scenario created', { scenarioName: scenario.name })

    res.status(201).json({
      success: true,
      data: {
        message: 'Scenario created successfully',
        scenarioName: scenario.name,
      },
    })
  } catch (error) {
    logger.error('Failed to create custom scenario', { error })
    res.status(500).json({
      success: false,
      error: 'Failed to create custom scenario',
    })
  }
})

/**
 * POST /api/reconciliation-testing/simulate/:scenarioName
 * Run a simulation for a specific scenario
 */
router.post('/simulate/:scenarioName', async (_req: Request, res: Response) => {
  try {
    const { scenarioName } = _req.params

    const result = await simulator.simulateScenario(scenarioName)

    logger.info('Simulation completed', {
      scenarioName,
      actualOutcome: result.actualOutcome,
      actualDuration: result.actualDuration,
    })

    res.json({
      success: true,
      data: {
        scenario: result.scenario,
        timeline: result.timeline,
        actualOutcome: result.actualOutcome,
        actualDuration: result.actualDuration,
        metrics: result.metrics,
        dataPointsCount: result.dataPoints.length,
        changeEventsCount: result.changeEvents.length,
      },
    })
  } catch (error) {
    logger.error('Simulation failed', {
      scenarioName: _req.params.scenarioName,
      error,
    })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed',
    })
  }
})

/**
 * POST /api/reconciliation-testing/simulate/batch
 * Run batch simulation for multiple scenarios
 */
router.post('/simulate/batch', async (_req: Request, res: Response) => {
  try {
    const { scenarioNames } = _req.body

    if (!Array.isArray(scenarioNames) || scenarioNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'scenarioNames must be a non-empty array',
      })
    }

    const results = await simulator.runBatchSimulation(scenarioNames)

    logger.info('Batch simulation completed', {
      requestedScenarios: scenarioNames.length,
      completedScenarios: results.length,
    })

    res.json({
      success: true,
      data: {
        results: results.map(result => ({
          scenario: result.scenario,
          actualOutcome: result.actualOutcome,
          actualDuration: result.actualDuration,
          metrics: result.metrics,
        })),
        summary: {
          requested: scenarioNames.length,
          completed: results.length,
          failed: scenarioNames.length - results.length,
        },
      },
    })
  } catch (error) {
    logger.error('Batch simulation failed', { error })
    res.status(500).json({
      success: false,
      error: 'Batch simulation failed',
    })
  }
})

/**
 * GET /api/reconciliation-testing/test-data/patterns
 * Get all available test data patterns
 */
router.get('/test-data/patterns', async (_req: Request, res: Response) => {
  try {
    const patterns = testDataGenerator.getAvailablePatterns()

    res.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
      },
    })
  } catch (error) {
    logger.error('Failed to get test data patterns', { error })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test data patterns',
    })
  }
})

/**
 * POST /api/reconciliation-testing/test-data/generate/:pattern
 * Generate test data for a specific pattern
 */
router.post(
  '/test-data/generate/:pattern',
  async (_req: Request, res: Response) => {
    try {
      const { pattern } = _req.params
      const { seed } = _req.body

      const testData = testDataGenerator.generateTestData(pattern, seed)

      logger.info('Test data generated', { pattern, seed })

      res.json({
        success: true,
        data: {
          pattern: testData.metadata.pattern,
          seed: testData.metadata.seed,
          districtDataCount: testData.districtData.length,
          expectedChangesCount: testData.expectedChanges.length,
          reconciliationJob: testData.reconciliationJob,
          config: testData.config,
          metadata: testData.metadata,
        },
      })
    } catch (error) {
      logger.error('Test data generation failed', {
        pattern: _req.params.pattern,
        error,
      })
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Test data generation failed',
      })
    }
  }
)

/**
 * POST /api/reconciliation-testing/test-data/batch
 * Generate batch test data for multiple patterns
 */
router.post('/test-data/batch', async (_req: Request, res: Response) => {
  try {
    const { patterns, count = 5 } = _req.body

    if (!Array.isArray(patterns) || patterns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'patterns must be a non-empty array',
      })
    }

    if (count < 1 || count > 50) {
      return res.status(400).json({
        success: false,
        error: 'count must be between 1 and 50',
      })
    }

    const testSets = testDataGenerator.generateBatchTestData(patterns, count)

    logger.info('Batch test data generated', {
      patterns: patterns.length,
      count,
      totalGenerated: testSets.length,
    })

    res.json({
      success: true,
      data: {
        testSets: testSets.map(testSet => ({
          pattern: testSet.metadata.pattern,
          seed: testSet.metadata.seed,
          districtDataCount: testSet.districtData.length,
          expectedChangesCount: testSet.expectedChanges.length,
          expectedOutcome: testSet.metadata.expectedOutcome,
        })),
        summary: {
          requestedPatterns: patterns.length,
          requestedCount: count,
          totalGenerated: testSets.length,
        },
      },
    })
  } catch (error) {
    logger.error('Batch test data generation failed', { error })
    res.status(500).json({
      success: false,
      error: 'Batch test data generation failed',
    })
  }
})

/**
 * GET /api/reconciliation-testing/test-data/edge-cases
 * Generate edge case test data
 */
router.get('/test-data/edge-cases', async (_req: Request, res: Response) => {
  try {
    const edgeCases = testDataGenerator.generateEdgeCases()

    logger.info('Edge cases generated', { count: edgeCases.length })

    res.json({
      success: true,
      data: {
        edgeCases: edgeCases.map(edgeCase => ({
          pattern: edgeCase.metadata.pattern,
          seed: edgeCase.metadata.seed,
          districtData: edgeCase.districtData[0], // First data point for preview
          expectedOutcome: edgeCase.metadata.expectedOutcome,
        })),
        count: edgeCases.length,
      },
    })
  } catch (error) {
    logger.error('Edge case generation failed', { error })
    res.status(500).json({
      success: false,
      error: 'Edge case generation failed',
    })
  }
})

/**
 * POST /api/reconciliation-testing/test-data/property-tests/:property
 * Generate property-based test cases
 */
router.post(
  '/test-data/property-tests/:property',
  async (_req: Request, res: Response) => {
    try {
      const { property } = _req.params
      const { count = 10 } = _req.body

      if (count < 1 || count > 200) {
        return res.status(400).json({
          success: false,
          error: 'count must be between 1 and 200',
        })
      }

      const testCases = testDataGenerator.generatePropertyTestCases(
        property,
        count
      )

      logger.info('Property test cases generated', {
        property,
        count: testCases.length,
      })

      res.json({
        success: true,
        data: {
          property,
          testCases: testCases.map(testCase => ({
            name: testCase.name,
            property: testCase.property,
            expectedResult: testCase.expectedResult,
            seed: testCase.seed,
            inputCount: testCase.inputs.length,
          })),
          count: testCases.length,
        },
      })
    } catch (error) {
      logger.error('Property test case generation failed', {
        property: _req.params.property,
        error,
      })
      res.status(500).json({
        success: false,
        error: 'Property test case generation failed',
      })
    }
  }
)

/**
 * POST /api/reconciliation-testing/replay/sessions
 * Create a new replay session
 */
router.post('/replay/sessions', async (_req: Request, res: Response) => {
  try {
    const { name, description, job, timeline, dataSequence } = _req.body

    if (!name || !description || !job || !timeline || !dataSequence) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: name, description, job, timeline, dataSequence',
      })
    }

    const session = replayEngine.createReplaySession(
      name,
      description,
      job,
      timeline,
      dataSequence
    )

    logger.info('Replay session created', { sessionId: session.id, name })

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        dataPointsCount: session.dataSequence.length,
        originalEntriesCount: session.originalTimeline.entries.length,
      },
    })
  } catch (error) {
    logger.error('Replay session creation failed', { error })
    res.status(500).json({
      success: false,
      error: 'Failed to create replay session',
    })
  }
})

/**
 * GET /api/reconciliation-testing/replay/sessions
 * Get all replay sessions
 */
router.get('/replay/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = replayEngine.getAllReplaySessions()

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session.id,
          name: session.name,
          description: session.description,
          createdAt: session.createdAt,
          lastUpdated: session.lastUpdated,
          currentStep: session.currentStep,
          dataPointsCount: session.dataSequence.length,
        })),
        count: sessions.length,
      },
    })
  } catch (error) {
    logger.error('Failed to get replay sessions', { error })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replay sessions',
    })
  }
})

/**
 * GET /api/reconciliation-testing/replay/sessions/:sessionId
 * Get a specific replay session
 */
router.get(
  '/replay/sessions/:sessionId',
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = _req.params
      const session = replayEngine.getReplaySession(sessionId)

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Replay session not found',
        })
      }

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            name: session.name,
            description: session.description,
            createdAt: session.createdAt,
            lastUpdated: session.lastUpdated,
            currentStep: session.currentStep,
            replayState: {
              currentTimeline: session.replayState.currentTimeline,
              processedEntries: session.replayState.processedEntries.length,
              stepResults: session.replayState.stepResults.length,
              debugInfo: session.replayState.debugInfo,
            },
          },
        },
      })
    } catch (error) {
      logger.error('Failed to get replay session', {
        sessionId: _req.params.sessionId,
        error,
      })
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve replay session',
      })
    }
  }
)

/**
 * POST /api/reconciliation-testing/replay/sessions/:sessionId/execute
 * Execute a replay session
 */
router.post(
  '/replay/sessions/:sessionId/execute',
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = _req.params
      const options: ReplayOptions = {
        stepByStep: _req.body.stepByStep || false,
        includeDebugInfo: _req.body.includeDebugInfo !== false, // Default true
        validateAtEachStep: _req.body.validateAtEachStep || false,
        pauseOnSignificantChanges: _req.body.pauseOnSignificantChanges || false,
        pauseOnErrors: _req.body.pauseOnErrors || false,
        maxSteps: _req.body.maxSteps,
      }

      const session = await replayEngine.executeReplay(sessionId, options)

      logger.info('Replay executed', {
        sessionId,
        currentStep: session.currentStep,
        totalSteps: session.replayState.stepResults.length,
      })

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          currentStep: session.currentStep,
          totalSteps: session.replayState.stepResults.length,
          debugInfo: session.replayState.debugInfo,
          finalStatus: session.replayState.currentTimeline.status,
          processedEntries: session.replayState.processedEntries.length,
        },
      })
    } catch (error) {
      logger.error('Replay execution failed', {
        sessionId: _req.params.sessionId,
        error,
      })
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Replay execution failed',
      })
    }
  }
)

/**
 * GET /api/reconciliation-testing/replay/sessions/:sessionId/export
 * Export replay session data
 */
router.get(
  '/replay/sessions/:sessionId/export',
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = _req.params
      const exportData = replayEngine.exportReplaySession(sessionId)

      logger.info('Replay session exported', { sessionId })

      res.json({
        success: true,
        data: exportData,
      })
    } catch (error) {
      logger.error('Replay export failed', {
        sessionId: _req.params.sessionId,
        error,
      })
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Replay export failed',
      })
    }
  }
)

/**
 * GET /api/reconciliation-testing/replay/sessions/:sessionId/compare
 * Compare replay results with original timeline
 */
router.get(
  '/replay/sessions/:sessionId/compare',
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = _req.params
      const comparison = replayEngine.compareWithOriginal(sessionId)

      logger.info('Replay comparison completed', { sessionId })

      res.json({
        success: true,
        data: comparison,
      })
    } catch (error) {
      logger.error('Replay comparison failed', {
        sessionId: _req.params.sessionId,
        error,
      })
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Replay comparison failed',
      })
    }
  }
)

/**
 * DELETE /api/reconciliation-testing/replay/sessions/:sessionId
 * Delete a replay session
 */
router.delete(
  '/replay/sessions/:sessionId',
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = _req.params
      const deleted = replayEngine.deleteReplaySession(sessionId)

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Replay session not found',
        })
      }

      logger.info('Replay session deleted', { sessionId })

      res.json({
        success: true,
        data: {
          message: 'Replay session deleted successfully',
        },
      })
    } catch (error) {
      logger.error('Replay session deletion failed', {
        sessionId: _req.params.sessionId,
        error,
      })
      res.status(500).json({
        success: false,
        error: 'Failed to delete replay session',
      })
    }
  }
)

export default router
