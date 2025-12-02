import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getWikiScrapingStatus } from '@/lib/db/wiki'

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

    const status = await getWikiScrapingStatus()

    return NextResponse.json({
      success: true,
      ...status,
      lastScraped: status.lastScraped ? status.lastScraped.toISOString() : null,
    })
  } catch (error) {
    console.error('Error in wiki status route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

