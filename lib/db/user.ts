import { getDatabase } from '../mongodb'
import type { User, UserProgress } from '../types/user'
import { ObjectId } from 'mongodb'

const COLLECTION_NAME = 'users'

/**
 * Create a new user
 */
export async function createUser(username: string, password: string): Promise<User> {
  const db = await getDatabase()
  const collection = db.collection<User>(COLLECTION_NAME)
  
  // Check if user already exists
  const existing = await collection.findOne({ username })
  if (existing) {
    throw new Error('Username already exists')
  }

  const now = new Date()
  const user: User = {
    username,
    password, // Should be hashed before calling this
    playerLevel: 1,
    completedQuestIds: [],
    createdAt: now,
    updatedAt: now,
  }

  const result = await collection.insertOne(user)
  user._id = result.insertedId
  return user
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await getDatabase()
  const collection = db.collection<User>(COLLECTION_NAME)
  return collection.findOne({ username })
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
  const db = await getDatabase()
  const collection = db.collection<User>(COLLECTION_NAME)
  try {
    return collection.findOne({ _id: new ObjectId(userId) })
  } catch {
    return null
  }
}

/**
 * Update user progress
 */
export async function updateUserProgress(
  userId: string,
  progress: UserProgress
): Promise<void> {
  const db = await getDatabase()
  const collection = db.collection<User>(COLLECTION_NAME)
  
  await collection.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        playerLevel: progress.playerLevel,
        completedQuestIds: progress.completedQuestIds,
        updatedAt: new Date(),
      },
    }
  )
}

