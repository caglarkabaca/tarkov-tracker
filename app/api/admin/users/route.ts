import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, findUserById } from '@/lib/db/user'

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

    // Get all users
    const users = await getAllUsers()

    // Return users without password hashes
    const sanitizedUsers = users.map(user => ({
      id: user._id?.toString(),
      username: user.username,
      playerLevel: user.playerLevel || 1,
      completedQuestIds: user.completedQuestIds || [],
      completedQuestCount: (user.completedQuestIds || []).length,
      isAdmin: user.isAdmin || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      users: sanitizedUsers,
      count: sanitizedUsers.length,
    })
  } catch (error) {
    console.error('Error in admin users route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

