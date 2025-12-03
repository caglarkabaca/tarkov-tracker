import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getCachedData } from '@/lib/db/tarkov'
import { scrapeQuestsFromWiki } from '@/lib/utils/wikiScraper'
import { batchSaveWikiQuestData, getAllWikiQuestData, createScrapingJob, addScrapingLog, updateScrapingJobStatus } from '@/lib/db/wiki'
import type { WikiQuestDocument, ScrapingLogEntry } from '@/lib/types/wiki'
import type { Task } from '@/lib/utils/questTree'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await findUserById(userId)
    
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get quests from cached data
    const cachedData = await getCachedData('quests')
    
    if (!cachedData || !('tasks' in cachedData)) {
      return NextResponse.json(
        { success: false, error: 'No quest data found. Please fetch quests first.' },
        { status: 404 }
      )
    }

    const tasks = cachedData.tasks as Task[]
    
    if (!tasks || tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No quests found in cache' },
        { status: 404 }
      )
    }

    // Create job ID
    const jobId = randomUUID()

    // Get existing wiki data for comparison
    const existingWikiData = await getAllWikiQuestData()
    const existingMap = new Map(
      existingWikiData.map(data => [
        data.questId,
        {
          previousQuests: data.previousQuests,
          leadsToQuests: data.leadsToQuests,
          minPlayerLevel: data.minPlayerLevel,
        }
      ])
    )

    // Prepare quest list for scraping (use wikiLink if available)
    const questsToScrape = tasks.map(task => ({
      id: task.id,
      name: task.name,
      wikiUrl: task.wikiLink,
    }))

    // Create scraping job
    await createScrapingJob(jobId, questsToScrape.length)

    // Start scraping asynchronously (don't await, return job ID immediately)
    scrapeQuestsWithLogging(jobId, questsToScrape, existingMap, tasks).catch(error => {
      console.error(`Error in scraping job ${jobId}:`, error)
      updateScrapingJobStatus(jobId, 'failed')
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Scraping job started. Check logs for progress.',
    })
  } catch (error) {
    console.error('Error in wiki scrape route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

async function scrapeQuestsWithLogging(
  jobId: string,
  questsToScrape: Array<{ id: string; name: string; wikiUrl?: string }>,
  existingMap: Map<string, { previousQuests?: string[]; leadsToQuests?: string[]; minPlayerLevel?: number }>,
  apiTasks: Task[]
) {
  try {
    // Create API data map for comparison - include full task objects
    const apiDataMap = new Map(
      apiTasks.map(task => [
        task.id,
        {
          minPlayerLevel: task.minPlayerLevel,
          taskRequirements: task.taskRequirements || [],
          taskRequirementNames: task.taskRequirements?.map(tr => tr.task.name) || [],
          trader: task.trader?.name,
          fullTask: task,
        }
      ])
    )

    // Log callback
    const onLog = async (log: { level: 'info' | 'success' | 'warning' | 'error'; message: string; questName?: string; questId?: string; details?: Record<string, unknown> }) => {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: log.level,
        message: log.message,
        questName: log.questName,
        questId: log.questId,
        details: log.details,
      })
    }

    // Scrape with logging, preferring raw_wiki_quests HTML where available
    const results = await scrapeQuestsFromWiki(questsToScrape, onLog, existingMap, apiDataMap, true)

    // Convert to WikiQuestDocument format
    const wikiDocuments: WikiQuestDocument[] = results.map(data => ({
      questId: data.questId,
      questName: data.questName,
      wikiUrl: data.wikiUrl,
      previousQuests: data.previousQuests || [],
      leadsToQuests: data.leadsToQuests || [],
      minPlayerLevel: data.minPlayerLevel,
      requirements: data.requirements,
      location: data.location,
      givenBy: data.givenBy,
      kappaRequired: data.kappaRequired,
      lightkeeperRequired: data.lightkeeperRequired,
      rewardsExp: data.rewardsExp,
      rewardsRep: data.rewardsRep,
      rewardsOther: data.rewardsOther,
      lastScraped: data.lastScraped || new Date(),
      needsUpdate: false,
    }))

    // Save to database
    await batchSaveWikiQuestData(wikiDocuments)

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'success',
      message: `Scraping completed successfully: ${wikiDocuments.length}/${questsToScrape.length} quests scraped`,
    })

    await updateScrapingJobStatus(jobId, 'completed')
  } catch (error) {
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'error',
      message: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
    await updateScrapingJobStatus(jobId, 'failed')
    throw error
  }
}
