/**
 * Wiki data structure for quest information
 */

export interface WikiQuestData {
  questId: string // Tarkov API quest ID
  questName: string // Quest name from API (for matching)
  wikiUrl?: string // URL to the wiki page
  previousQuests?: string[] // Quest names from "Previous" section
  previousQuestLinks?: Array<{ name: string; wikiUrl: string }> // Quest links from "Previous" section (more reliable)
  leadsToQuests?: string[] // Quest names from "Leads To" section
  minPlayerLevel?: number // Extracted from Requirements section
  requirements?: string // Raw requirements text
  // Infobox data
  location?: string // Map name (e.g., "Ground Zero")
  givenBy?: string // Trader name (e.g., "Prapor")
  kappaRequired?: boolean // Whether required for Kappa container
  lightkeeperRequired?: boolean // Whether required for Lightkeeper
  // Rewards data
  rewardsExp?: number // Experience points from rewards
  rewardsRep?: Array<{ trader: string; amount: number }> // Trader reputation rewards
  rewardsOther?: string[] // Other rewards (Roubles, items, etc.) as strings
  // Quest image
  questImage?: string // Quest image URL from infobox mainimage
  // Objectives data
  objectives?: Array<{
    id: string
    type: string
    description?: string
    optional?: boolean
    maps?: string[] // Map names
  }>
  // Guide section
  guideSteps?: string[] // Guide steps/items if "Guide" section exists
  lastScraped?: Date // When this data was last scraped
  needsUpdate?: boolean // Flag if data needs to be re-scraped
}

/**
 * Wiki quest mapping document in MongoDB
 */
export interface WikiQuestDocument {
  _id?: string
  questId: string
  questName: string
  wikiUrl?: string
  previousQuests?: string[]
  leadsToQuests?: string[]
  minPlayerLevel?: number
  requirements?: string
  // Infobox data
  location?: string
  givenBy?: string
  kappaRequired?: boolean
  lightkeeperRequired?: boolean
  // Rewards data
  rewardsExp?: number
  rewardsRep?: Array<{ trader: string; amount: number }>
  rewardsOther?: string[]
  // Quest image
  questImage?: string
  // Objectives data
  objectives?: Array<{
    id: string
    type: string
    description?: string
    optional?: boolean
    maps?: string[]
  }>
  // Guide section
  guideSteps?: string[]
  lastScraped: Date
  needsUpdate: boolean
}

/**
 * Quest name mapping between API and Wiki
 */
export interface QuestNameMapping {
  apiName: string // Name from Tarkov API
  wikiName?: string // Name as it appears on wiki
  wikiUrl?: string // Full wiki URL
  normalizedName?: string // Normalized for matching
}

/**
 * Log entry for scraping process
 */
export interface ScrapingLogEntry {
  timestamp: Date
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  questName?: string
  questId?: string
  details?: Record<string, unknown>
}

/**
 * Scraping log document in MongoDB
 */
export interface ScrapingLogDocument {
  _id?: string
  jobId: string
  logs: ScrapingLogEntry[]
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  totalQuests: number
  processedQuests: number
  successfulQuests: number
  failedQuests: number
}
