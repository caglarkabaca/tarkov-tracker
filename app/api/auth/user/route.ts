import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 401 }
      )
    }

    const user = await findUserById(userId)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id?.toString(),
        username: user.username,
        playerLevel: user.playerLevel,
        completedQuestIds: user.completedQuestIds || [],
        isAdmin: user.isAdmin || false,
      },
    })
  } catch (error) {
    console.error('Error in user route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

