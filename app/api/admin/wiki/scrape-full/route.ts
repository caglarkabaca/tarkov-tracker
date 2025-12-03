import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { extractAllQuestsFromListPage, scrapeQuestFromWiki } from '@/lib/utils/wikiScraper'
import { convertWikiQuestsToTasks } from '@/lib/utils/wikiQuestConverter'
import { saveWikiQuestTasks, updateScrapingProgress, clearScrapingProgress } from '@/lib/db/wikiQuests'
import { getCachedData } from '@/lib/db/tarkov'
import { createScrapingJob, addScrapingLog, updateScrapingJobStatus } from '@/lib/db/wiki'
import { randomUUID } from 'crypto'
import type { WikiQuestData } from '@/lib/types/wiki'

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

    // Create job ID for logging
    const jobId = randomUUID()

    // Start scraping asynchronously (don't await, return job ID immediately)
    scrapeFullQuestsFromWiki(jobId).catch(error => {
      console.error(`Error in full scraping job ${jobId}:`, error)
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Full quest scraping job started. Check logs for progress.',
    })
  } catch (error) {
    console.error('Error in wiki scrape-full route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

async function scrapeFullQuestsFromWiki(jobId: string) {
  try {
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: 'Starting full quest scraping from wiki...',
    })

    // Fetch traders from cache (we still use tarkov-api for traders)
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: 'Fetching traders data...',
    })

    const tradersData = await getCachedData('traders')
    const traders =
      tradersData && 'traders' in tradersData
        ? (tradersData.traders as Array<{
            id: string
            name: string
            normalizedName?: string
            image4xLink?: string
          }>)
        : []

    if (traders.length === 0) {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: 'warning',
        message: 'No traders found in cache. Quest trader information may be incomplete.',
      })
    } else {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: 'info',
        message: `Found ${traders.length} traders`,
      })
    }

    // Extract quest list from wiki
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: 'Extracting quest list from wiki...',
    })

    const questList = await extractAllQuestsFromListPage()

    if (questList.length === 0) {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: 'error',
        message: 'No quests found in wiki list page',
      })
      await updateScrapingJobStatus(jobId, 'failed')
      return
    }

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'success',
      message: `Found ${questList.length} quests in wiki list`,
    })

    // Create scraping job after we know how many quests we have
    await createScrapingJob(jobId, questList.length)

    // Log callback for scraping progress
    const onLog = async (log: {
      level: 'info' | 'success' | 'warning' | 'error'
      message: string
      questName?: string
      questId?: string
      details?: Record<string, unknown>
    }) => {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: log.level,
        message: log.message,
        questName: log.questName,
        questId: log.questId,
        details: log.details,
      })
    }

    // Scrape all quests from wiki, then convert & save using the full dataset
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: `Starting to scrape ${questList.length} quests (incremental save enabled)...`,
    })

    // When using raw_wiki_quests as cache we don't need extra delay;
    // scrapeQuestFromWiki will still fall back to live wiki if raw HTML is missing.
    const scrapedQuests: WikiQuestData[] = []
    let successfulCount = 0
    let failedCount = 0

    // Process quests in parallel when using raw HTML cache to maximize speed
    const concurrency = Math.min(8, questList.length || 1)
    let currentIndex = 0

    const worker = async () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const i = currentIndex++
        if (i >= questList.length) break

        const quest = questList[i]
        const questId = quest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

        await addScrapingLog(jobId, {
          timestamp: new Date(),
          level: 'info',
          message: `[${i + 1}/${questList.length}] Scraping: ${quest.name}`,
          questName: quest.name,
          questId,
        })

        // Update progress state (best-effort, order doesn't need to be perfect)
        await updateScrapingProgress(jobId, i, questList.length, quest.name)

        try {
          // Prefer raw HTML from raw_wiki_quests where available
          const wikiData = await scrapeQuestFromWiki(quest.name, questId, quest.wikiUrl, true)
          
          if (wikiData) {
            scrapedQuests.push(wikiData)
            successfulCount++

            await addScrapingLog(jobId, {
              timestamp: new Date(),
              level: 'success',
              message: `✓ Saved: ${quest.name}`,
              questName: quest.name,
              questId,
            })
          } else {
            failedCount++
            await addScrapingLog(jobId, {
              timestamp: new Date(),
              level: 'warning',
              message: `✗ Failed to scrape: ${quest.name}`,
              questName: quest.name,
              questId,
            })
          }
        } catch (error) {
          failedCount++
          await addScrapingLog(jobId, {
            timestamp: new Date(),
            level: 'error',
            message: `✗ Error scraping ${quest.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            questName: quest.name,
            questId,
          })
        }

        // Update scraping job progress (coarse-grained, may be slightly out of order)
        await updateScrapingJobStatus(jobId, 'running', {
          processedQuests: successfulCount + failedCount,
          successfulQuests: successfulCount,
          failedQuests: failedCount,
        })
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    // After we have ALL wiki data, convert using the full set so that
    // previousQuests / leadsToQuests can resolve reliably across quests.
    if (scrapedQuests.length > 0) {
      const allTasks = convertWikiQuestsToTasks(scrapedQuests, traders)
      await saveWikiQuestTasks(allTasks)
    }

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'success',
      message: `Scraping completed: ${successfulCount}/${questList.length} quests scraped and saved successfully`,
    })

    // Clear progress state and update lastUpdated
    await clearScrapingProgress()

    await updateScrapingJobStatus(jobId, 'completed', {
      processedQuests: questList.length,
      successfulQuests: successfulCount,
      failedQuests: failedCount,
    })
  } catch (error) {
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'error',
      message: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
    // Clear progress state on failure
    await clearScrapingProgress()
    
    await updateScrapingJobStatus(jobId, 'failed')
    throw error
  }
}

