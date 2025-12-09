import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { extractAllQuestsFromListPage } from '@/lib/utils/wikiScraper'
import { saveRawWikiQuest, getRawWikiQuestsStatus } from '@/lib/db/rawWikiQuests'
import { getWikiUrlForQuest } from '@/lib/utils/wikiScraper'

/**
 * Generate quest ID from quest name
 */
function generateQuestId(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Fetch raw HTML from wiki URL
 */
async function fetchWikiPageHtml(wikiUrl: string): Promise<string | null> {
  try {
    const response = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      console.error(`Failed to fetch ${wikiUrl}: ${response.status} ${response.statusText}`)
      return null
    }

    return await response.text()
  } catch (error) {
    console.error(`Error fetching ${wikiUrl}:`, error)
    return null
  }
}

/**
 * POST /api/admin/wiki/raw/fetch
 * Fetch all quest pages from wiki and save raw HTML to MongoDB
 */
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

    // Extract quest list from wiki
    const questList = await extractAllQuestsFromListPage()

    if (questList.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No quests found in wiki list page',
      })
    }

    // Fetch and save raw HTML for each quest
    let fetched = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < questList.length; i++) {
      const quest = questList[i]
      const questId = generateQuestId(quest.name)
      const wikiUrl = quest.wikiUrl || getWikiUrlForQuest(quest.name)

      try {
        const rawHtml = await fetchWikiPageHtml(wikiUrl)

        if (rawHtml) {
          await saveRawWikiQuest(quest.name, questId, wikiUrl, rawHtml)
          fetched++
        } else {
          failed++
          errors.push(`Failed to fetch: ${quest.name}`)
        }

        // Add delay to avoid rate limiting (100ms between requests)
        if (i < questList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        failed++
        errors.push(`Error processing ${quest.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Get status
    const status = await getRawWikiQuestsStatus()

    return NextResponse.json({
      success: true,
      message: `Fetched ${fetched} raw wiki quest pages, ${failed} failed`,
      fetched,
      failed,
      total: questList.length,
      status,
      errors: errors.slice(0, 10), // Limit error messages
    })
  } catch (error) {
    console.error('Error in fetch raw wiki quests route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/wiki/raw/status
 * Get status of raw wiki quests
 */
export async function GET(request: NextRequest) {
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

    const status = await getRawWikiQuestsStatus()

    return NextResponse.json({
      success: true,
      status,
    })
  } catch (error) {
    console.error('Error in get raw wiki quests status route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}


