import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import {
  getWikiQuestTasksFetchStatus,
  getScrapingProgress,
  checkWikiQuestTasksCache,
} from '@/lib/db/wikiQuests'

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

    // Get quest tasks status
    const questStatus = await getWikiQuestTasksFetchStatus()
    const progress = await getScrapingProgress()
    const cacheCheck = await checkWikiQuestTasksCache()

    return NextResponse.json({
      success: true,
      status: {
        ...questStatus,
        progress,
        cacheExists: cacheCheck.exists,
        tasksCount: cacheCheck.tasks?.length || 0,
      },
    })
  } catch (error) {
    console.error('Error in quest status route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

