import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { extractAllQuestsFromListPage } from '@/lib/utils/wikiScraper'

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
    const { wikiUrl } = body || {}
    
    const listPageUrl = wikiUrl || 'https://escapefromtarkov.fandom.com/wiki/Quests'

    // Extract all quests from the list page
    const quests = await extractAllQuestsFromListPage(listPageUrl)

    return NextResponse.json({
      success: true,
      quests,
      count: quests.length,
    })
  } catch (error) {
    console.error('Error in wiki list route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

