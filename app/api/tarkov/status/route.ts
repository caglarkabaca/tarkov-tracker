import { NextRequest, NextResponse } from 'next/server'
import { getFetchStatus } from '@/lib/db/tarkov'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryName = searchParams.get('queryName') || 'quests'

    const status = await getFetchStatus(queryName)

    return NextResponse.json({
      success: true,
      queryName,
      ...status,
      cacheValid: !status.shouldFetch,
      cacheDurationHours: 24,
    })
  } catch (error) {
    console.error('Error in status route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

