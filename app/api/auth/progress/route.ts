import { NextRequest, NextResponse } from 'next/server'
import { updateUserProgress } from '@/lib/db/user'
import type { UserProgress } from '@/lib/types/user'

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const progress: UserProgress = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 401 }
      )
    }

    if (!progress.playerLevel || !Array.isArray(progress.completedQuestIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid progress data' },
        { status: 400 }
      )
    }

    await updateUserProgress(userId, progress)

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully',
    })
  } catch (error) {
    console.error('Error in progress route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

