import { getDatabase } from '../mongodb'
import type { TarkovDataDocument, CacheCheckResult, FetchStatus } from '../types/tarkov'

const COLLECTION_NAME = 'tarkov_data'
const CACHE_DURATION_HOURS = 24

/**
 * Check if data exists and if we should fetch new data
 */
export async function checkLastFetch(queryName: string = 'default'): Promise<CacheCheckResult> {
  try {
    const db = await getDatabase()
    const collection = db.collection<TarkovDataDocument>(COLLECTION_NAME)
    
    const existing = await collection.findOne({ queryName })
    
    if (!existing) {
      return {
        exists: false,
        lastFetched: null,
        data: null,
        shouldFetch: true,
      }
    }

    const now = new Date()
    const lastFetched = existing.lastFetched
    const hoursSinceLastFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60)
    const shouldFetch = hoursSinceLastFetch >= CACHE_DURATION_HOURS

    return {
      exists: true,
      lastFetched,
      data: existing.data,
      shouldFetch,
    }
  } catch (error) {
    console.error('Error checking last fetch:', error)
    throw error
  }
}

/**
 * Save fetched data to MongoDB
 */
export async function saveFetchedData(
  data: Record<string, unknown>,
  query?: string,
  queryName: string = 'default'
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<TarkovDataDocument>(COLLECTION_NAME)
    
    const document: TarkovDataDocument = {
      lastFetched: new Date(),
      data,
      query,
      queryName,
    }

    // Upsert: Update if exists, insert if not
    await collection.updateOne(
      { queryName },
      { $set: document },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving fetched data:', error)
    throw error
  }
}

/**
 * Get cached data from MongoDB
 */
export async function getCachedData(queryName: string = 'default'): Promise<Record<string, unknown> | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<TarkovDataDocument>(COLLECTION_NAME)
    
    const existing = await collection.findOne({ queryName })
    
    if (!existing) {
      return null
    }

    return existing.data
  } catch (error) {
    console.error('Error getting cached data:', error)
    throw error
  }
}

/**
 * Get fetch status
 */
export async function getFetchStatus(queryName: string = 'default'): Promise<FetchStatus> {
  try {
    const cacheCheck = await checkLastFetch(queryName)
    const now = new Date()
    
    if (!cacheCheck.lastFetched) {
      return {
        lastFetched: null,
        shouldFetch: true,
        hoursSinceLastFetch: null,
      }
    }

    const hoursSinceLastFetch = (now.getTime() - cacheCheck.lastFetched.getTime()) / (1000 * 60 * 60)

    return {
      lastFetched: cacheCheck.lastFetched,
      shouldFetch: cacheCheck.shouldFetch,
      hoursSinceLastFetch,
    }
  } catch (error) {
    console.error('Error getting fetch status:', error)
    throw error
  }
}

/**
 * Force clear cache for a specific query
 */
export async function clearCache(queryName: string = 'default'): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<TarkovDataDocument>(COLLECTION_NAME)
    
    await collection.deleteOne({ queryName })
  } catch (error) {
    console.error('Error clearing cache:', error)
    throw error
  }
}

