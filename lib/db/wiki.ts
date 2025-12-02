import { getDatabase } from '../mongodb'
import type { WikiQuestDocument, ScrapingLogDocument, ScrapingLogEntry } from '../types/wiki'
import { ObjectId } from 'mongodb'

const COLLECTION_NAME = 'wiki_quest_data'
const LOG_COLLECTION_NAME = 'wiki_scraping_logs'

/**
 * Save wiki quest data to MongoDB
 */
export async function saveWikiQuestData(data: WikiQuestDocument): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  await collection.updateOne(
    { questId: data.questId },
    {
      $set: {
        ...data,
        lastScraped: data.lastScraped || new Date(),
      },
    },
    { upsert: true }
  )
}

/**
 * Get wiki quest data by quest ID
 */
export async function getWikiQuestData(questId: string): Promise<WikiQuestDocument | null> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  return collection.findOne({ questId })
}

/**
 * Get wiki quest data by quest name (for name-based lookup)
 */
export async function getWikiQuestDataByName(questName: string): Promise<WikiQuestDocument | null> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  return collection.findOne({ questName })
}

/**
 * Get all wiki quest data
 */
export async function getAllWikiQuestData(): Promise<WikiQuestDocument[]> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  return collection.find({}).toArray()
}

/**
 * Batch save wiki quest data
 */
export async function batchSaveWikiQuestData(dataList: WikiQuestDocument[]): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  const operations = dataList.map(data => ({
    updateOne: {
      filter: { questId: data.questId },
      update: {
        $set: {
          ...data,
          lastScraped: data.lastScraped || new Date(),
        },
      },
      upsert: true,
    },
  }))
  
  if (operations.length > 0) {
    await collection.bulkWrite(operations)
  }
}

/**
 * Get scraping status - how many quests have wiki data
 */
export async function getWikiScrapingStatus(): Promise<{
  total: number
  lastScraped: Date | null
  needsUpdate: number
}> {
  const db = await getDatabase()
  const collection = db.collection<WikiQuestDocument>(COLLECTION_NAME)
  
  const total = await collection.countDocuments()
  const needsUpdate = await collection.countDocuments({ needsUpdate: true })
  
  const lastScrapedDoc = await collection
    .find({})
    .sort({ lastScraped: -1 })
    .limit(1)
    .toArray()
  
  return {
    total,
    lastScraped: lastScrapedDoc.length > 0 ? lastScrapedDoc[0].lastScraped : null,
    needsUpdate,
  }
}

/**
 * Create a new scraping job log
 */
export async function createScrapingJob(jobId: string, totalQuests: number): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<ScrapingLogDocument>(LOG_COLLECTION_NAME)
  
  await collection.insertOne({
    jobId,
    logs: [],
    status: 'running',
    startedAt: new Date(),
    totalQuests,
    processedQuests: 0,
    successfulQuests: 0,
    failedQuests: 0,
  })
}

/**
 * Add log entry to scraping job
 */
export async function addScrapingLog(jobId: string, log: ScrapingLogEntry): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<ScrapingLogDocument>(LOG_COLLECTION_NAME)
  
  await collection.updateOne(
    { jobId },
    {
      $push: { logs: log },
      $inc: {
        processedQuests: log.level === 'success' || log.level === 'warning' ? 1 : 0,
        successfulQuests: log.level === 'success' ? 1 : 0,
        failedQuests: log.level === 'error' ? 1 : 0,
      },
    }
  )
}

/**
 * Update scraping job status
 */
export async function updateScrapingJobStatus(
  jobId: string,
  status: 'running' | 'completed' | 'failed'
): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<ScrapingLogDocument>(LOG_COLLECTION_NAME)
  
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status,
        completedAt: new Date(),
      },
    }
  )
}

/**
 * Get scraping job logs
 */
export async function getScrapingJobLogs(jobId: string): Promise<ScrapingLogDocument | null> {
  const db = await getDatabase()
  const collection = db.collection<ScrapingLogDocument>(LOG_COLLECTION_NAME)
  
  return collection.findOne({ jobId })
}

/**
 * Get latest scraping job
 */
export async function getLatestScrapingJob(): Promise<ScrapingLogDocument | null> {
  const db = await getDatabase()
  const collection = db.collection<ScrapingLogDocument>(LOG_COLLECTION_NAME)
  
  const latest = await collection
    .find({})
    .sort({ startedAt: -1 })
    .limit(1)
    .toArray()
  
  return latest.length > 0 ? latest[0] : null
}
