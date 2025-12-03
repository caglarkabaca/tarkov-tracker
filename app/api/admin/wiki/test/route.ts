import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { scrapeQuestFromWiki } from '@/lib/utils/wikiScraper'

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

    const body = await request.json()
    const { wikiUrl } = body

    if (!wikiUrl || typeof wikiUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'wikiUrl is required' },
        { status: 400 }
      )
    }

    // Extract quest name from URL if possible
    const urlMatch = wikiUrl.match(/\/wiki\/(.+?)(?:\?|$)/)
    const questName = urlMatch ? decodeURIComponent(urlMatch[1].replace(/_/g, ' ')) : 'Test Quest'
    const questId = 'test-' + Date.now()

    // Scrape the wiki page
    const result = await scrapeQuestFromWiki(questName, questId, wikiUrl)

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to scrape wiki page' },
        { status: 500 }
      )
    }

    // Debug: Log objectives and guideSteps
    console.log('[Test Wiki Scraper] Objectives:', result.objectives?.length || 0, result.objectives)
    console.log('[Test Wiki Scraper] Guide Steps:', result.guideSteps?.length || 0, result.guideSteps)

    return NextResponse.json({
      success: true,
      result: {
        questId: result.questId,
        questName: result.questName,
        wikiUrl: result.wikiUrl,
        previousQuests: result.previousQuests || [],
        leadsToQuests: result.leadsToQuests || [],
        minPlayerLevel: result.minPlayerLevel,
        requirements: result.requirements,
        location: result.location,
        givenBy: result.givenBy,
        kappaRequired: result.kappaRequired,
        lightkeeperRequired: result.lightkeeperRequired,
        rewardsExp: result.rewardsExp,
        rewardsRep: result.rewardsRep || [],
        rewardsOther: result.rewardsOther || [],
        questImage: result.questImage,
        objectives: result.objectives || [],
        guideSteps: result.guideSteps || [],
        lastScraped: result.lastScraped,
      },
    })
  } catch (error) {
    console.error('Error in wiki test route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

