import { ObjectId } from 'mongodb'

export interface User {
  _id?: ObjectId
  username: string
  password: string // Hashed
  playerLevel?: number
  completedQuestIds?: string[]
  isAdmin?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserProgress {
  playerLevel: number
  completedQuestIds: string[]
}

export interface LoginResponse {
  success: boolean
  user?: {
    id: string
    username: string
    playerLevel?: number
  }
  token?: string
  error?: string
}

