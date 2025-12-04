/**
 * MongoDB functions for storing wiki quest data as Task format
 * Each quest is stored as a separate document for better scalability and performance
 */

import { getDatabase } from '../mongodb'
import type { Task } from '../utils/questTree'

const COLLECTION_NAME = 'wiki_quests'
const METADATA_ID = 'metadata'
const CACHE_DURATION_HOURS = 24

/**
 * Individual quest document stored in MongoDB
 */
export interface WikiQuestTaskDocument {
  _id: string // Quest ID (task.id)
  questId: string // Same as _id, for clarity
  task: Task
  lastFetched: Date
  lastUpdated?: Date
}

/**
 * Metadata document for tracking overall collection status
 */
export interface WikiQuestMetadataDocument {
  _id: string // Always 'metadata'
  lastFetched: Date
  lastUpdated?: Date
  totalCount: number
  scrapingProgress?: {
    jobId: string
    currentIndex: number
    totalQuests: number
    lastScrapedQuest?: string
    updatedAt: Date
  }
}

/**
 * Save wiki quest tasks to MongoDB
 * Each quest is saved as a separate document
 */
export async function saveWikiQuestTasks(tasks: Task[]): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    const now = new Date()

    // Save each quest as a separate document
    const operations = tasks.map(task => ({
      updateOne: {
        filter: { _id: task.id },
        update: {
          $set: {
            _id: task.id,
            questId: task.id,
            task,
            lastFetched: now,
            lastUpdated: now,
          },
        },
        upsert: true,
      },
    }))

    if (operations.length > 0) {
      await collection.bulkWrite(operations)
    }

    // Update metadata
    await metadataCollection.updateOne(
      { _id: METADATA_ID },
      {
        $set: {
          _id: METADATA_ID,
          lastFetched: now,
          lastUpdated: now,
          totalCount: tasks.length,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving wiki quest tasks:', error)
    throw error
  }
}

/**
 * Get cached wiki quest tasks from MongoDB
 * Collects all individual quest documents
 */
export async function getCachedWikiQuestTasks(): Promise<Task[] | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    // Get all quest documents (exclude metadata)
    const questDocs = await collection
      .find({ _id: { $ne: METADATA_ID } })
      .toArray()

    if (questDocs.length === 0) {
      return null
    }

    // Extract tasks from documents and filter out legacy documents without task data
    const tasks = questDocs
      .map(doc => doc.task)
      .filter((task): task is Task => !!task && typeof task === 'object')

    if (tasks.length === 0) {
      return null
    }

    return tasks
  } catch (error) {
    console.error('Error getting cached wiki quest tasks:', error)
    throw error
  }
}

/**
 * Check if wiki quest tasks exist and if we should fetch new data
 */
export async function checkWikiQuestTasksCache(): Promise<{
  exists: boolean
  lastFetched: Date | null
  tasks: Task[] | null
  shouldFetch: boolean
}> {
  try {
    const db = await getDatabase()
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    // Check metadata first
    const metadata = await metadataCollection.findOne({ _id: METADATA_ID })

    if (!metadata) {
      // Check if there are any quest documents (legacy support)
      const questCount = await collection.countDocuments({ _id: { $ne: METADATA_ID } })
      if (questCount === 0) {
        return {
          exists: false,
          lastFetched: null,
          tasks: null,
          shouldFetch: true,
        }
      }
      // Legacy data exists, fetch all tasks
      const tasks = await getCachedWikiQuestTasks()
      return {
        exists: true,
        lastFetched: null,
        tasks,
        shouldFetch: true, // Force fetch to create metadata
      }
    }

    // Get all tasks
    const tasks = await getCachedWikiQuestTasks()

    // Handle legacy documents that might be missing lastFetched
    const now = new Date()
    const lastFetched = metadata.lastFetched || metadata.lastUpdated || now
    const hoursSinceLastFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60)
    const shouldFetch = !metadata.lastFetched || hoursSinceLastFetch >= CACHE_DURATION_HOURS

    return {
      exists: true,
      lastFetched,
      tasks,
      shouldFetch,
    }
  } catch (error) {
    console.error('Error checking wiki quest tasks cache:', error)
    throw error
  }
}

/**
 * Get fetch status for wiki quest tasks
 */
export async function getWikiQuestTasksFetchStatus(): Promise<{
  lastFetched: Date | null
  shouldFetch: boolean
  hoursSinceLastFetch: number | null
  totalCount: number | null
}> {
  try {
    const cacheCheck = await checkWikiQuestTasksCache()
    const now = new Date()

    if (!cacheCheck.lastFetched) {
      return {
        lastFetched: null,
        shouldFetch: true,
        hoursSinceLastFetch: null,
        totalCount: null,
      }
    }

    const hoursSinceLastFetch = (now.getTime() - cacheCheck.lastFetched.getTime()) / (1000 * 60 * 60)

    return {
      lastFetched: cacheCheck.lastFetched,
      shouldFetch: cacheCheck.shouldFetch,
      hoursSinceLastFetch,
      totalCount: cacheCheck.tasks?.length || null,
    }
  } catch (error) {
    console.error('Error getting wiki quest tasks fetch status:', error)
    throw error
  }
}

/**
 * Clear wiki quest tasks cache
 * Deletes all quest documents and metadata
 */
export async function clearWikiQuestTasksCache(): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    // Delete all quest documents
    await collection.deleteMany({ _id: { $ne: METADATA_ID } })
    
    // Delete metadata
    await metadataCollection.deleteOne({ _id: METADATA_ID })
  } catch (error) {
    console.error('Error clearing wiki quest tasks cache:', error)
    throw error
  }
}

/**
 * Save or update a single quest task incrementally
 * Saves/updates a single quest as its own document
 */
export async function saveWikiQuestTaskIncremental(task: Task): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    const now = new Date()

    // Save/update the individual quest document
    await collection.updateOne(
      { _id: task.id },
      {
        $set: {
          _id: task.id,
          questId: task.id,
          task,
          lastFetched: now,
          lastUpdated: now,
        },
      },
      { upsert: true }
    )

    // Update metadata total count
    const totalCount = await collection.countDocuments({ _id: { $ne: METADATA_ID } })
    await metadataCollection.updateOne(
      { _id: METADATA_ID },
      {
        $set: {
          _id: METADATA_ID,
          lastUpdated: now,
          totalCount,
        },
        $setOnInsert: {
          lastFetched: now,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving wiki quest task incrementally:', error)
    throw error
  }
}

/**
 * Update scraping progress state
 * Stored in metadata document
 */
export async function updateScrapingProgress(
  jobId: string,
  currentIndex: number,
  totalQuests: number,
  lastScrapedQuest?: string
): Promise<void> {
  try {
    const db = await getDatabase()
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    await metadataCollection.updateOne(
      { _id: METADATA_ID },
      {
        $set: {
          _id: METADATA_ID,
          scrapingProgress: {
            jobId,
            currentIndex,
            totalQuests,
            lastScrapedQuest,
            updatedAt: new Date(),
          },
        },
        $setOnInsert: {
          lastFetched: new Date(),
          lastUpdated: new Date(),
          totalCount: 0,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error updating scraping progress:', error)
    // Don't throw, this is not critical
  }
}

/**
 * Get scraping progress state
 * Reads from metadata document
 */
export async function getScrapingProgress(): Promise<{
  jobId?: string
  currentIndex?: number
  totalQuests?: number
  lastScrapedQuest?: string
  updatedAt?: Date
} | null> {
  try {
    const db = await getDatabase()
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    const metadata = await metadataCollection.findOne({ _id: METADATA_ID })
    
    if (!metadata || !metadata.scrapingProgress) {
      return null
    }

    return metadata.scrapingProgress
  } catch (error) {
    console.error('Error getting scraping progress:', error)
    return null
  }
}

/**
 * Clear scraping progress state
 * Removes progress from metadata document
 */
export async function clearScrapingProgress(): Promise<void> {
  try {
    const db = await getDatabase()
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    await metadataCollection.updateOne(
      { _id: METADATA_ID },
      {
        $unset: { scrapingProgress: '' },
        $set: { lastUpdated: new Date() },
      }
    )
  } catch (error) {
    console.error('Error clearing scraping progress:', error)
    // Don't throw, this is not critical
  }
}

/**
 * Get a single quest task by ID
 */
export async function getWikiQuestTaskById(questId: string): Promise<Task | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    const doc = await collection.findOne({ _id: questId })
    return doc ? doc.task : null
  } catch (error) {
    console.error('Error getting wiki quest task by ID:', error)
    throw error
  }
}

/**
 * Update a single quest task
 */
export async function updateWikiQuestTask(questId: string, task: Task): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)
    const metadataCollection = db.collection<WikiQuestMetadataDocument>(COLLECTION_NAME)

    const now = new Date()

    // Update the quest document
    await collection.updateOne(
      { _id: questId },
      {
        $set: {
          _id: questId,
          questId,
          task,
          lastUpdated: now,
        },
        $setOnInsert: {
          lastFetched: now,
        },
      },
      { upsert: true }
    )

    // Update metadata lastUpdated timestamp
    await metadataCollection.updateOne(
      { _id: METADATA_ID },
      {
        $set: {
          lastUpdated: now,
        },
      },
      { upsert: false }
    )
  } catch (error) {
    console.error('Error updating wiki quest task:', error)
    throw error
  }
}

