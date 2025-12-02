import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getFetchStatus, getCachedData } from '@/lib/db/tarkov'

interface DataStatus {
  queryName: string
  lastFetched: Date | null
  hoursSinceLastFetch: number | null
  shouldFetch: boolean
  cacheValid: boolean
  dataCount: number
  dataType: string
}

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

    // Get status for all data types
    const dataTypes = [
      { queryName: 'quests', dataType: 'Quests' },
      { queryName: 'traders', dataType: 'Traders' },
    ]

    const statuses: DataStatus[] = []

    for (const { queryName, dataType } of dataTypes) {
      const status = await getFetchStatus(queryName)
      const cachedData = await getCachedData(queryName)
      
      let dataCount = 0
      if (cachedData) {
        if (queryName === 'quests' && cachedData.tasks && Array.isArray(cachedData.tasks)) {
          dataCount = cachedData.tasks.length
        } else if (queryName === 'traders' && cachedData.traders && Array.isArray(cachedData.traders)) {
          dataCount = cachedData.traders.length
        }
      }

      statuses.push({
        queryName,
        lastFetched: status.lastFetched ? status.lastFetched.toISOString() : null,
        hoursSinceLastFetch: status.hoursSinceLastFetch,
        shouldFetch: status.shouldFetch,
        cacheValid: !status.shouldFetch && status.lastFetched !== null,
        dataCount,
        dataType,
      })
    }

    return NextResponse.json({
      success: true,
      dataStatuses: statuses,
    })
  } catch (error) {
    console.error('Error in data status route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

