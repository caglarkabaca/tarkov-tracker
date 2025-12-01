/**
 * Quest progress utility functions
 * Handles done quests and unlocks quests based on requirements
 */

import type { Task } from './questTree'

const DONE_QUESTS_STORAGE_KEY = 'tarkov-quest-done'

/**
 * Get done quest IDs from localStorage
 */
export function getDoneQuestIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  
  try {
    const stored = localStorage.getItem(DONE_QUESTS_STORAGE_KEY)
    if (stored) {
      const ids = JSON.parse(stored) as string[]
      return new Set(ids)
    }
  } catch (error) {
    console.error('Error reading done quests from localStorage:', error)
  }
  
  return new Set()
}

/**
 * Save done quest IDs to localStorage
 */
export function saveDoneQuestIds(doneIds: Set<string>): void {
  if (typeof window === 'undefined') return
  
  try {
    const ids = Array.from(doneIds)
    localStorage.setItem(DONE_QUESTS_STORAGE_KEY, JSON.stringify(ids))
  } catch (error) {
    console.error('Error saving done quests to localStorage:', error)
  }
}

/**
 * Check if a quest is done
 */
export function isQuestDone(questId: string, doneIds: Set<string>): boolean {
  return doneIds.has(questId)
}

/**
 * Toggle quest done status
 */
export function toggleQuestDone(questId: string, doneIds: Set<string>): Set<string> {
  const newDoneIds = new Set(doneIds)
  if (newDoneIds.has(questId)) {
    newDoneIds.delete(questId)
  } else {
    newDoneIds.add(questId)
  }
  saveDoneQuestIds(newDoneIds)
  return newDoneIds
}

/**
 * Check if a quest is unlocked based on done requirements
 * A quest is unlocked if all its required quests are done
 */
export function isQuestUnlocked(quest: Task, doneIds: Set<string>): boolean {
  // If no requirements, it's unlocked
  if (!quest.taskRequirements || quest.taskRequirements.length === 0) {
    return true
  }

  // Check if all required quests are done
  return quest.taskRequirements.every(req => {
    const requiredQuestId = req.task?.id
    if (!requiredQuestId) return true // If no ID, consider it done
    
    return doneIds.has(requiredQuestId)
  })
}

/**
 * Get all unlocked quests based on done quests
 */
export function getUnlockedQuests(tasks: Task[], doneIds: Set<string>): Task[] {
  return tasks.filter(task => isQuestUnlocked(task, doneIds))
}

/**
 * Get quests that are unlocked by a specific done quest
 * (Quests that require this quest as a prerequisite)
 */
export function getQuestsUnlockedByQuest(tasks: Task[], questId: string): Task[] {
  return tasks.filter(task => {
    if (!task.taskRequirements || task.taskRequirements.length === 0) {
      return false
    }

    // Check if this quest requires the specified quest
    return task.taskRequirements.some(req => req.task?.id === questId)
  })
}

