import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { extractAllQuestsFromListPage, scrapeQuestFromWiki } from '@/lib/utils/wikiScraper'
import { convertWikiQuestToTask } from '@/lib/utils/wikiQuestConverter'
import { saveWikiQuestTaskIncremental, updateScrapingProgress, clearScrapingProgress, getCachedWikiQuestTasks } from '@/lib/db/wikiQuests'
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
    scrapeMissingQuestsFromWiki(jobId).catch(error => {
      console.error(`Error in missing quests scraping job ${jobId}:`, error)
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Missing quests scraping job started. Check logs for progress.',
    })
  } catch (error) {
    console.error('Error in wiki scrape-missing route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

async function scrapeMissingQuestsFromWiki(jobId: string) {
  try {
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: 'Starting missing quests scraping from wiki...',
    })

    // Fetch traders from cache
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

    // Get existing quest tasks from MongoDB
    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: 'Checking existing quests in MongoDB...',
    })

    const existingTasks = await getCachedWikiQuestTasks()
    const existingQuestNames = new Set(
      (existingTasks || []).map(task => task.name.toLowerCase().trim())
    )

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: `Found ${existingQuestNames.size} existing quests in database`,
    })

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

    // Find missing quests
    const missingQuests = questList.filter(
      quest => !existingQuestNames.has(quest.name.toLowerCase().trim())
    )

    if (missingQuests.length === 0) {
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: 'success',
        message: 'No missing quests found. All quests are already scraped.',
      })
      await updateScrapingJobStatus(jobId, 'completed')
      return
    }

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'info',
      message: `Found ${missingQuests.length} missing quests to scrape`,
    })

    // Create scraping job after we know how many quests we have
    await createScrapingJob(jobId, missingQuests.length)

    // Scrape missing quests one by one and save incrementally
    const delay = 2000 // 2 second delay between requests
    const scrapedQuests: WikiQuestData[] = []
    let successfulCount = 0
    let failedCount = 0

    for (let i = 0; i < missingQuests.length; i++) {
      const quest = missingQuests[i]
      const questId = quest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      
      await addScrapingLog(jobId, {
        timestamp: new Date(),
        level: 'info',
        message: `[${i + 1}/${missingQuests.length}] Scraping missing quest: ${quest.name}`,
        questName: quest.name,
        questId,
      })

      // Update progress state
      await updateScrapingProgress(jobId, i, missingQuests.length, quest.name)

      try {
        const wikiData = await scrapeQuestFromWiki(quest.name, questId, quest.wikiUrl)
        
        if (wikiData) {
          scrapedQuests.push(wikiData)
          
          // Convert to Task format
          const task = convertWikiQuestToTask(wikiData, traders, scrapedQuests)
          
          // Save incrementally to MongoDB
          await saveWikiQuestTaskIncremental(task)
          
          successfulCount++
          
          await addScrapingLog(jobId, {
            timestamp: new Date(),
            level: 'success',
            message: `✓ Saved missing quest: ${quest.name}`,
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

      // Rate limiting - wait before next request (except for last quest)
      if (i < missingQuests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Update scraping job progress
      await updateScrapingJobStatus(jobId, 'running', {
        processedQuests: i + 1,
        successfulQuests: successfulCount,
        failedQuests: failedCount,
      })
    }

    await addScrapingLog(jobId, {
      timestamp: new Date(),
      level: 'success',
      message: `Missing quests scraping completed: ${successfulCount}/${missingQuests.length} quests scraped and saved successfully`,
    })

    // Clear progress state and update lastUpdated
    await clearScrapingProgress()

    await updateScrapingJobStatus(jobId, 'completed', {
      processedQuests: missingQuests.length,
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

