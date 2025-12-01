import { NextRequest, NextResponse } from 'next/server'
import { findUserByUsername } from '@/lib/db/user'
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

    const user = await findUserByUsername(username)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const hashedPassword = hashPassword(password)
    
    if (user.password !== hashedPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id?.toString(),
        username: user.username,
        playerLevel: user.playerLevel,
        isAdmin: user.isAdmin || false,
      },
    })
  } catch (error) {
    console.error('Error in login route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

