import { NextRequest, NextResponse } from 'next/server'
import { getCachedData } from '@/lib/db/tarkov'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryName = searchParams.get('queryName') || 'quests'

    const cachedData = await getCachedData(queryName)

    if (!cachedData) {
      return NextResponse.json(
        {
          success: false,
          error: 'No cached data found. Please fetch data first.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: cachedData,
      queryName,
    })
  } catch (error) {
    console.error('Error in data route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

