/**
 * Raw wiki quest data - stores raw HTML content
 */

export interface RawWikiQuestDocument {
  _id?: string
  questName: string
  questId: string
  wikiUrl: string
  rawHtml: string
  fetchedAt: Date
  lastScrapedAt?: Date
  scrapingJobId?: string
}


