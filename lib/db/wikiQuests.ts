/**
 * MongoDB functions for storing wiki quest data as Task format
 */

import { getDatabase } from '../mongodb'
import type { Task } from '../utils/questTree'

const COLLECTION_NAME = 'wiki_quests'
const CACHE_DURATION_HOURS = 24

export interface WikiQuestTaskDocument {
  _id?: string
  lastFetched: Date
  lastUpdated?: Date
  tasks: Task[]
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
 */
export async function saveWikiQuestTasks(tasks: Task[]): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    const document: WikiQuestTaskDocument = {
      lastFetched: new Date(),
      tasks,
      totalCount: tasks.length,
    }

    // Upsert: Update if exists, insert if not
    await collection.updateOne(
      { _id: 'quests' },
      { $set: document },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving wiki quest tasks:', error)
    throw error
  }
}

/**
 * Get cached wiki quest tasks from MongoDB
 */
export async function getCachedWikiQuestTasks(): Promise<Task[] | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    const existing = await collection.findOne({ _id: 'quests' })

    if (!existing) {
      return null
    }

    return existing.tasks || []
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
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    const existing = await collection.findOne({ _id: 'quests' })

    if (!existing) {
      return {
        exists: false,
        lastFetched: null,
        tasks: null,
        shouldFetch: true,
      }
    }

    // Handle legacy documents that might be missing lastFetched
    const now = new Date()
    const lastFetched = existing.lastFetched || existing.lastUpdated || now
    const hoursSinceLastFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60)
    const shouldFetch = !existing.lastFetched || hoursSinceLastFetch >= CACHE_DURATION_HOURS

    return {
      exists: true,
      lastFetched,
      tasks: existing.tasks || [],
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
 */
export async function clearWikiQuestTasksCache(): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    await collection.deleteOne({ _id: 'quests' })
  } catch (error) {
    console.error('Error clearing wiki quest tasks cache:', error)
    throw error
  }
}

/**
 * Save or update a single quest task incrementally
 * Adds or updates a task in the tasks array without replacing all tasks
 */
export async function saveWikiQuestTaskIncremental(task: Task): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    // Get existing document or create new one
    const existing = await collection.findOne({ _id: 'quests' })
    
    const now = new Date()
    let tasks: Task[] = []
    
    if (existing && existing.tasks) {
      tasks = existing.tasks
      // Check if task already exists and update it, or add new one
      const existingIndex = tasks.findIndex(t => t.id === task.id)
      if (existingIndex >= 0) {
        tasks[existingIndex] = task
      } else {
        tasks.push(task)
      }
    } else {
      tasks = [task]
    }

    await collection.updateOne(
      { _id: 'quests' },
      {
        $set: {
          lastFetched: now,
          tasks,
          totalCount: tasks.length,
          lastUpdated: now,
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
 */
export async function updateScrapingProgress(
  jobId: string,
  currentIndex: number,
  totalQuests: number,
  lastScrapedQuest?: string
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    await collection.updateOne(
      { _id: 'quests' },
      {
        $set: {
          scrapingProgress: {
            jobId,
            currentIndex,
            totalQuests,
            lastScrapedQuest,
            updatedAt: new Date(),
          },
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
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    const existing = await collection.findOne({ _id: 'quests' })
    
    if (!existing || !('scrapingProgress' in existing)) {
      return null
    }

    return (existing as any).scrapingProgress || null
  } catch (error) {
    console.error('Error getting scraping progress:', error)
    return null
  }
}

/**
 * Clear scraping progress state
 */
export async function clearScrapingProgress(): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiQuestTaskDocument>(COLLECTION_NAME)

    await collection.updateOne(
      { _id: 'quests' },
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

