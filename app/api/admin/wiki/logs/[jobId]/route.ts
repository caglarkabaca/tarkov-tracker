import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getScrapingJobLogs } from '@/lib/db/wiki'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params
    
    const jobLogs = await getScrapingJobLogs(jobId)

    if (!jobLogs) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      job: jobLogs,
    })
  } catch (error) {
    console.error('Error in wiki logs route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

