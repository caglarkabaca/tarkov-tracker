import { NextRequest, NextResponse } from 'next/server'
import { findUserById, updateUserAdminStatus } from '@/lib/db/user'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check if requesting user is admin
    const adminUserId = request.headers.get('x-user-id')
    
    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminUser = await findUserById(adminUserId)
    
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get target user ID from params (Next.js 16 passes params as a Promise)
    const { userId: targetUserId } = await context.params
    
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get isAdmin from request body
    const { isAdmin } = await request.json()
    
    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isAdmin must be a boolean' },
        { status: 400 }
      )
    }

    // Prevent admin from removing their own admin status
    if (adminUserId === targetUserId && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You cannot remove your own admin status' },
        { status: 400 }
      )
    }

    // Update user admin status
    await updateUserAdminStatus(targetUserId, isAdmin)

    return NextResponse.json({
      success: true,
      message: `User admin status updated to ${isAdmin}`,
    })
  } catch (error) {
    console.error('Error updating user admin status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

