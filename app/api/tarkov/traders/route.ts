import { NextRequest, NextResponse } from 'next/server'
import { checkLastFetch, saveFetchedData, getCachedData } from '@/lib/db/tarkov'
import { executeGraphQLQueryWithRetry } from '@/lib/graphql/client'
import { TRADERS_QUERY } from '@/lib/graphql/queries'

const QUERY_NAME = 'traders'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const force = searchParams.get('force') === 'true'

    // Check cache unless force refresh
    if (!force) {
      const cacheCheck = await checkLastFetch(QUERY_NAME)
      
      if (!cacheCheck.shouldFetch && cacheCheck.data) {
        return NextResponse.json({
          success: true,
          cached: true,
          message: 'Data is still fresh, returning cached data',
          lastFetched: cacheCheck.lastFetched,
          data: cacheCheck.data,
        })
      }

      // Try to get cached data first
      const cachedData = await getCachedData(QUERY_NAME)
      if (cachedData) {
        return NextResponse.json({
          success: true,
          cached: true,
          data: cachedData,
        })
      }
    }

    // Fetch new data
    const response = await executeGraphQLQueryWithRetry(TRADERS_QUERY)

    if (!response.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'No data received from GraphQL API',
          errors: response.errors,
        },
        { status: 500 }
      )
    }

    // Save to MongoDB
    await saveFetchedData(response.data as Record<string, unknown>, TRADERS_QUERY, QUERY_NAME)

    return NextResponse.json({
      success: true,
      cached: false,
      message: 'Data fetched and cached successfully',
      lastFetched: new Date(),
      data: response.data,
    })
  } catch (error) {
    console.error('Error in traders route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

