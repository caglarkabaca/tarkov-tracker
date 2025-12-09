import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getWikiQuestTaskById, updateWikiQuestTask } from '@/lib/db/wikiQuests'
import type { Task } from '@/lib/utils/questTree'

/**
 * GET /api/admin/quests/[questId]
 * Get a single quest task
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ questId: string }> }
) {
  try {
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

    const { questId } = await context.params
    const task = await getWikiQuestTaskById(questId)

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Quest not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      task,
    })
  } catch (error) {
    console.error('Error in get quest route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/quests/[questId]
 * Update a quest task
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ questId: string }> }
) {
  try {
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

    const { questId } = await context.params
    const body = await request.json()
    const task = body.task as Task

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task data is required' },
        { status: 400 }
      )
    }

    // Ensure questId matches
    if (task.id !== questId) {
      return NextResponse.json(
        { success: false, error: 'Quest ID mismatch' },
        { status: 400 }
      )
    }

    await updateWikiQuestTask(questId, task)

    return NextResponse.json({
      success: true,
      message: 'Quest updated successfully',
    })
  } catch (error) {
    console.error('Error in update quest route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

