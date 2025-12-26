/* global console */
import { ReconciliationStorageOptimizer } from './dist/services/ReconciliationStorageOptimizer.js'

async function testStorage() {
  const storage = new ReconciliationStorageOptimizer('./cache/debug-test')
  await storage.init()

  const testJob = {
    id: 'test-job-1',
    districtId: 'D42',
    targetMonth: '2024-11',
    status: 'active',
    startDate: new Date(),
    maxEndDate: new Date(Date.now() + 86400000),
    config: {},
    triggeredBy: 'manual',
    progress: { phase: 'monitoring', completionPercentage: 0 },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      triggeredBy: 'manual',
    },
  }

  console.log('Saving job...')
  await storage.saveJob(testJob)

  console.log('Flushing...')
  await storage.flush()

  console.log('Getting all jobs...')
  const allJobs = await storage.getAllJobs()
  console.log('Found jobs:', allJobs.length)
  console.log(
    'Job IDs:',
    allJobs.map(j => j.id)
  )

  console.log('Getting job directly...')
  const directJob = await storage.getJob('test-job-1')
  console.log('Direct job found:', !!directJob)
}

testStorage().catch(console.error)
