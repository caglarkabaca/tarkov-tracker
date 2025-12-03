import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { extractAllQuestsFromListPage, scrapeQuestsFromWiki } from '@/lib/utils/wikiScraper'
import { convertWikiQuestsToTasks } from '@/lib/utils/wikiQuestConverter'
import {
  saveWikiQuestTasks,
  checkWikiQuestTasksCache,
  getCachedWikiQuestTasks,
} from '@/lib/db/wikiQuests'
import { getCachedData } from '@/lib/db/tarkov'
import { getWikiImages } from '@/lib/db/wikiImages'
import type { WikiQuestData } from '@/lib/types/wiki'
import type { Task } from '@/lib/utils/questTree'

/**
 * Replace image URLs with base64 data if available in wiki_images collection
 */
async function replaceImagesWithBase64(tasks: Task[]): Promise<Task[]> {
  try {
    // Collect all image URLs
    const imageUrls = tasks
      .map((task) => task.taskImageLink)
      .filter((url): url is string => !!url && url.startsWith('http'))

    if (imageUrls.length === 0) {
      return tasks
    }

    // Get base64 images from MongoDB
    const imageMap = await getWikiImages(imageUrls)

    // Replace URLs with base64 in tasks
    return tasks.map((task) => {
      if (task.taskImageLink && imageMap.has(task.taskImageLink)) {
        return {
          ...task,
          taskImageLink: imageMap.get(task.taskImageLink)!,
        }
      }
      return task
    })
  } catch (error) {
    console.error('Error replacing images with base64:', error)
    // Return original tasks if error occurs
    return tasks
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const force = searchParams.get('force') === 'true'

    // If force fetch, check if user is admin
    if (force) {
      const userId = request.headers.get('x-user-id')
      if (userId) {
        const user = await findUserById(userId)
        if (!user || !user.isAdmin) {
          return NextResponse.json(
            {
              success: false,
              error: 'Only admins can force fetch data',
            },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required for force fetch',
          },
          { status: 401 }
        )
      }
    }

    // Check cache unless force refresh
    if (!force) {
      const cacheCheck = await checkWikiQuestTasksCache()

      if (!cacheCheck.shouldFetch && cacheCheck.tasks) {
        // Replace image URLs with base64 if available
        const tasksWithBase64Images = await replaceImagesWithBase64(cacheCheck.tasks)
        return NextResponse.json({
          success: true,
          cached: true,
          message: 'Data is still fresh, returning cached data',
          lastFetched: cacheCheck.lastFetched,
          data: {
            tasks: tasksWithBase64Images,
          },
        })
      }

      // Try to get cached data first
      const cachedTasks = await getCachedWikiQuestTasks()
      if (cachedTasks && cachedTasks.length > 0) {
        // Replace image URLs with base64 if available
        const tasksWithBase64Images = await replaceImagesWithBase64(cachedTasks)
        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            tasks: tasksWithBase64Images,
          },
        })
      }
    }

    // Fetch traders from cache (we still use tarkov-api for traders)
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

    // Extract quest list from wiki
    const questList = await extractAllQuestsFromListPage()

    if (questList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No quests found in wiki list page',
        },
        { status: 404 }
      )
    }

    // Scrape all quests from wiki
    const wikiQuestsData = await scrapeQuestsFromWiki(
      questList.map((q) => ({
        id: q.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: q.name,
        wikiUrl: q.wikiUrl,
      })),
      undefined, // No logging callback for this route
      undefined, // No existing wiki data for comparison
      undefined // No API data for comparison
    )

    // Convert wiki quests to Task format
    const tasks = convertWikiQuestsToTasks(wikiQuestsData, traders)

    // Save to MongoDB
    await saveWikiQuestTasks(tasks)

    // Replace image URLs with base64 if available
    const tasksWithBase64Images = await replaceImagesWithBase64(tasks)

    return NextResponse.json({
      success: true,
      cached: false,
      message: 'Wiki quest data fetched and cached successfully',
      lastFetched: new Date(),
      data: {
        tasks: tasksWithBase64Images,
      },
    })
  } catch (error) {
    console.error('Error in wiki quests route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

