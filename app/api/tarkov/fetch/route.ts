import { NextRequest, NextResponse } from 'next/server'
import { checkLastFetch, saveFetchedData } from '@/lib/db/tarkov'
import { executeGraphQLQueryWithRetry } from '@/lib/graphql/client'
import { QUESTS_QUERY } from '@/lib/graphql/queries'
import { findUserById } from '@/lib/db/user'

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const userId = request.headers.get('x-user-id')
    if (userId) {
      const user = await findUserById(userId)
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only admins can fetch data',
          },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const { query, queryName = 'quests', force = false } = body

    const graphqlQuery = query || QUESTS_QUERY

    // Check cache unless force refresh
    if (!force) {
      const cacheCheck = await checkLastFetch(queryName)
      
      if (!cacheCheck.shouldFetch) {
        return NextResponse.json({
          success: true,
          cached: true,
          message: 'Data is still fresh, returning cached data',
          lastFetched: cacheCheck.lastFetched,
          data: cacheCheck.data,
        })
      }
    }

    // Fetch new data
    const response = await executeGraphQLQueryWithRetry(graphqlQuery)

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
    await saveFetchedData(response.data as Record<string, unknown>, graphqlQuery, queryName)

    return NextResponse.json({
      success: true,
      cached: false,
      message: 'Data fetched and cached successfully',
      lastFetched: new Date(),
      data: response.data,
    })
  } catch (error) {
    console.error('Error in fetch route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const userId = request.headers.get('x-user-id')
    if (userId) {
      const user = await findUserById(userId)
      if (!user || !user.isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only admins can fetch data',
          },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const queryName = searchParams.get('queryName') || 'quests'
    const force = searchParams.get('force') === 'true'

    const graphqlQuery = QUESTS_QUERY

    // Check cache unless force refresh
    if (!force) {
      const cacheCheck = await checkLastFetch(queryName)
      
      if (!cacheCheck.shouldFetch) {
        return NextResponse.json({
          success: true,
          cached: true,
          message: 'Data is still fresh, returning cached data',
          lastFetched: cacheCheck.lastFetched,
          data: cacheCheck.data,
        })
      }
    }

    // Fetch new data
    const response = await executeGraphQLQueryWithRetry(graphqlQuery)

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
    await saveFetchedData(response.data as Record<string, unknown>, graphqlQuery, queryName)

    return NextResponse.json({
      success: true,
      cached: false,
      message: 'Data fetched and cached successfully',
      lastFetched: new Date(),
      data: response.data,
    })
  } catch (error) {
    console.error('Error in fetch route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

