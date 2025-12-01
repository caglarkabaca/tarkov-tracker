import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/db/user'
import crypto from 'crypto'

/**
 * Simple password hashing (for development)
 * In production, use bcrypt
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      )
    }

    if (username.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username must be at least 3 characters' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters' },
        { status: 400 }
      )
    }

    const hashedPassword = hashPassword(password)
    const user = await createUser(username, hashedPassword)

    return NextResponse.json({
      success: true,
      user: {
        id: user._id?.toString(),
        username: user.username,
        playerLevel: user.playerLevel,
      },
    })
  } catch (error) {
    console.error('Error in register route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

