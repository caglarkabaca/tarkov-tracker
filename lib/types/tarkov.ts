/**
 * Tarkov data collection structure
 */
export interface TarkovDataDocument {
  _id?: string
  lastFetched: Date
  data: Record<string, unknown>
  query?: string
  queryName?: string
}

/**
 * Fetch status response
 */
export interface FetchStatus {
  lastFetched: Date | null
  shouldFetch: boolean
  hoursSinceLastFetch: number | null
}

/**
 * Cache check result
 */
export interface CacheCheckResult {
  exists: boolean
  lastFetched: Date | null
  data: Record<string, unknown> | null
  shouldFetch: boolean
}

