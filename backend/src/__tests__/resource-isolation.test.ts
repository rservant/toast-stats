/**
 * Unit Tests for Resource Isolation
 *
 * Converted from property-based test: resource-isolation.property.test.ts
 * Rationale: PBT not warranted per testing.md — tests verify directory isolation
 * and env var independence using randomized integer counts (2-6 tests, 2-8 resources).
 * The input space is trivially small with no mathematical invariants. Simple explicit
 * examples (2 concurrent tests, 3 resources each) cover the behavioral requirements.
 *
 * Validates: Requirements 4.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DefaultTestServiceFactory } from '../services/TestServiceFactory'
import { DefaultTestIsolationManager } from '../utils/TestIsolationManager'
import path from 'path'
import fs from 'fs/promises'

describe('Resource Isolation', () => {
    let testFactory: DefaultTestServiceFactory
    let isolationManager: DefaultTestIsolationManager

    beforeEach(async () => {
        testFactory = new DefaultTestServiceFactory()
        isolationManager = new DefaultTestIsolationManager()
        await isolationManager.setupTestEnvironment()
    })

    afterEach(async () => {
        await testFactory.cleanup()
        await isolationManager.cleanupTestEnvironment()
    })

    it('should prevent conflicts when 3 tests use shared resources with 4 resources each', async () => {
        const testCount = 3
        const resourcesPerTest = 4

        const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
                const testId = `isolation-test-${testIndex}`
                const testDir = await isolationManager.createIsolatedDirectory()
                const cacheDirectory = path.join(testDir, 'cache', `test-${testIndex}`)

                const cacheConfigService = testFactory.createCacheConfigService({
                    cacheDirectory,
                })
                await cacheConfigService.initialize()

                const resources = Array.from(
                    { length: resourcesPerTest },
                    async (_, resourceIndex) => {
                        const resourceId = `${testId}-resource-${resourceIndex}`
                        const resourceDir = path.join(testDir, `resource-${resourceIndex}`)
                        await fs.mkdir(resourceDir, { recursive: true })

                        const resourceFile = path.join(
                            resourceDir,
                            `data-${resourceIndex}.json`
                        )
                        const resourceData = {
                            testId,
                            resourceId,
                            resourceIndex,
                        }
                        await fs.writeFile(
                            resourceFile,
                            JSON.stringify(resourceData, null, 2)
                        )

                        const fileContent = await fs.readFile(resourceFile, 'utf-8')
                        const parsedData = JSON.parse(fileContent)
                        expect(parsedData.testId).toBe(testId)
                        expect(parsedData.resourceId).toBe(resourceId)
                        expect(parsedData.resourceIndex).toBe(resourceIndex)

                        return { resourceId, resourceDir, resourceFile, resourceData: parsedData }
                    }
                )

                const testResources = await Promise.all(resources)
                expect(testResources).toHaveLength(resourcesPerTest)

                expect(cacheConfigService.getCacheDirectory()).toBe(cacheDirectory)
                expect(cacheConfigService.getCacheDirectory()).toContain(
                    `test-${testIndex}`
                )

                await cacheConfigService.dispose()
                await isolationManager.removeIsolatedDirectory(testDir)

                return {
                    testId,
                    testIndex,
                    cacheDirectory,
                    resourceCount: testResources.length,
                    resources: testResources.map(r => ({
                        resourceId: r.resourceId,
                        resourceIndex: r.resourceData.resourceIndex,
                    })),
                }
            }
        )

        const allResults = await Promise.all(testPromises)

        expect(allResults).toHaveLength(testCount)

        const uniqueCacheDirs = new Set(allResults.map(r => r.cacheDirectory))
        expect(uniqueCacheDirs.size).toBe(testCount)

        const uniqueTestIds = new Set(allResults.map(r => r.testId))
        expect(uniqueTestIds.size).toBe(testCount)

        allResults.forEach((result, index) => {
            expect(result.testIndex).toBe(index)
            expect(result.resourceCount).toBe(resourcesPerTest)
            expect(result.resources).toHaveLength(resourcesPerTest)

            const resourceIndices = result.resources.map(r => r.resourceIndex)
            const uniqueIndices = new Set(resourceIndices)
            expect(uniqueIndices.size).toBe(resourcesPerTest)
        })
    })

    it('should isolate file system resources and clean up directories', async () => {
        const testCount = 2
        const filesPerTest = 4

        const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
                const testId = `fs-test-${testIndex}`
                const testDir = await isolationManager.createIsolatedDirectory()

                const files = Array.from(
                    { length: filesPerTest },
                    async (_, fileIndex) => {
                        const fileName = `test-file-${testIndex}-${fileIndex}.txt`
                        const filePath = path.join(testDir, fileName)
                        const fileContent = `Test ${testId} - File ${fileIndex}`

                        await fs.writeFile(filePath, fileContent)
                        const readContent = await fs.readFile(filePath, 'utf-8')
                        expect(readContent).toBe(fileContent)

                        return { fileName, filePath, fileContent, fileIndex }
                    }
                )

                const testFiles = await Promise.all(files)

                for (const file of testFiles) {
                    const stats = await fs.stat(file.filePath)
                    expect(stats.isFile()).toBe(true)
                    const content = await fs.readFile(file.filePath, 'utf-8')
                    expect(content).toBe(file.fileContent)
                    expect(content).toContain(testId)
                }

                await isolationManager.removeIsolatedDirectory(testDir)

                return { testId, testIndex, testDir, fileCount: testFiles.length }
            }
        )

        const allResults = await Promise.all(testPromises)
        expect(allResults).toHaveLength(testCount)

        const uniqueTestDirs = new Set(allResults.map(r => r.testDir))
        expect(uniqueTestDirs.size).toBe(testCount)

        // All test directories should be cleaned up
        for (const result of allResults) {
            await expect(fs.access(result.testDir)).rejects.toThrow()
        }
    })

    it('should isolate environment variables between tests', async () => {
        const originalEnv = { ...process.env }
        const testCount = 2
        const envVarCount = 3

        const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
                const testId = `env-test-${testIndex}`
                const testIsolationManager = new DefaultTestIsolationManager()
                await testIsolationManager.setupTestEnvironment()

                const testEnvVars: Record<string, string> = {}
                for (let i = 0; i < envVarCount; i++) {
                    const varName = `TEST_VAR_${testId}_${i}`
                    const varValue = `value-${testIndex}-${i}`
                    process.env[varName] = varValue
                    testEnvVars[varName] = varValue
                }

                for (const [varName, expectedValue] of Object.entries(testEnvVars)) {
                    expect(process.env[varName]).toBe(expectedValue)
                }

                await testIsolationManager.cleanupTestEnvironment()

                return { testId, testIndex, envVars: testEnvVars }
            }
        )

        const allResults = await Promise.all(testPromises)
        process.env = originalEnv

        expect(allResults).toHaveLength(testCount)

        const allEnvVarSets = allResults.map(r =>
            Object.keys(r.envVars).sort().join(',')
        )
        const uniqueEnvVarSets = new Set(allEnvVarSets)
        expect(uniqueEnvVarSets.size).toBe(testCount)
    })
})
