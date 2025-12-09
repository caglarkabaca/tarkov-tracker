/**
 * MongoDB functions for storing raw wiki quest HTML pages
 */

import { getDatabase } from '../mongodb'
import type { RawWikiQuestDocument } from '../types/rawWiki'

const COLLECTION_NAME = 'raw_wiki_quests'

/**
 * Save or update raw wiki quest HTML
 */
export async function saveRawWikiQuest(
  questName: string,
  questId: string,
  wikiUrl: string,
  rawHtml: string
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    await collection.updateOne(
      { questId },
      {
        $set: {
          questName,
          questId,
          wikiUrl,
          rawHtml,
          fetchedAt: new Date(),
        },
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving raw wiki quest:', error)
    throw error
  }
}

/**
 * Get raw wiki quest by quest ID
 */
export async function getRawWikiQuest(questId: string): Promise<RawWikiQuestDocument | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    return collection.findOne({ questId })
  } catch (error) {
    console.error('Error getting raw wiki quest:', error)
    throw error
  }
}

/**
 * Get raw wiki quest by quest name
 */
export async function getRawWikiQuestByName(questName: string): Promise<RawWikiQuestDocument | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    return collection.findOne({ questName })
  } catch (error) {
    console.error('Error getting raw wiki quest by name:', error)
    throw error
  }
}

/**
 * Get all raw wiki quests
 */
export async function getAllRawWikiQuests(): Promise<RawWikiQuestDocument[]> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    return collection.find({}).sort({ fetchedAt: -1 }).toArray()
  } catch (error) {
    console.error('Error getting all raw wiki quests:', error)
    throw error
  }
}

/**
 * Get raw wiki quests count
 */
export async function getRawWikiQuestsCount(): Promise<number> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    return collection.countDocuments()
  } catch (error) {
    console.error('Error getting raw wiki quests count:', error)
    throw error
  }
}

/**
 * Check if raw wiki quest exists
 */
export async function rawWikiQuestExists(questId: string): Promise<boolean> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    const count = await collection.countDocuments({ questId })
    return count > 0
  } catch (error) {
    console.error('Error checking if raw wiki quest exists:', error)
    throw error
  }
}

/**
 * Delete raw wiki quest
 */
export async function deleteRawWikiQuest(questId: string): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    await collection.deleteOne({ questId })
  } catch (error) {
    console.error('Error deleting raw wiki quest:', error)
    throw error
  }
}

/**
 * Clear all raw wiki quests
 */
export async function clearAllRawWikiQuests(): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    await collection.deleteMany({})
  } catch (error) {
    console.error('Error clearing all raw wiki quests:', error)
    throw error
  }
}

/**
 * Update last scraped timestamp
 */
export async function updateLastScrapedAt(questId: string, jobId?: string): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    await collection.updateOne(
      { questId },
      {
        $set: {
          lastScrapedAt: new Date(),
          ...(jobId && { scrapingJobId: jobId }),
        },
      }
    )
  } catch (error) {
    console.error('Error updating last scraped at:', error)
    // Don't throw, this is not critical
  }
}

/**
 * Get raw wiki quests status
 */
export async function getRawWikiQuestsStatus(): Promise<{
  total: number
  oldestFetched?: Date
  newestFetched?: Date
  lastScraped?: Date
}> {
  try {
    const db = await getDatabase()
    const collection = db.collection<RawWikiQuestDocument>(COLLECTION_NAME)

    const total = await collection.countDocuments()

    if (total === 0) {
      return { total: 0 }
    }

    const oldest = await collection.find({}).sort({ fetchedAt: 1 }).limit(1).toArray()
    const newest = await collection.find({}).sort({ fetchedAt: -1 }).limit(1).toArray()
    const lastScraped = await collection
      .find({ lastScrapedAt: { $exists: true } })
      .sort({ lastScrapedAt: -1 })
      .limit(1)
      .toArray()

    return {
      total,
      oldestFetched: oldest[0]?.fetchedAt,
      newestFetched: newest[0]?.fetchedAt,
      lastScraped: lastScraped[0]?.lastScrapedAt,
    }
  } catch (error) {
    console.error('Error getting raw wiki quests status:', error)
    throw error
  }
}


