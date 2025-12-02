/**
 * Utility to merge Tarkov API quest data with wiki-scraped data
 */

import type { Task } from './questTree'
import type { WikiQuestDocument } from '../types/wiki'
import { getWikiQuestData } from '../db/wiki'

/**
 * Merge wiki data with API quest data
 */
export async function mergeQuestWithWikiData(quest: Task): Promise<Task> {
  try {
    const wikiData = await getWikiQuestData(quest.id)
    
    if (!wikiData) {
      return quest // Return original if no wiki data
    }

    const mergedQuest: Task = { ...quest }

    // Update minPlayerLevel if wiki has a more accurate one
    if (wikiData.minPlayerLevel && (!quest.minPlayerLevel || wikiData.minPlayerLevel !== quest.minPlayerLevel)) {
      mergedQuest.minPlayerLevel = wikiData.minPlayerLevel
    }

    // Add wiki data as metadata (for future use)
    // We can extend Task interface later if needed
    // For now, we'll use taskRequirements to update from wiki's previousQuests
    
    // Note: We can't directly modify taskRequirements structure here without breaking
    // the API contract. Instead, we'll create a separate utility to enhance the quest
    // data when displaying or use wiki data for validation.

    return mergedQuest
  } catch (error) {
    console.error(`Error merging wiki data for quest ${quest.id}:`, error)
    return quest // Return original on error
  }
}

/**
 * Get wiki data for a quest (helper function)
 */
export async function getWikiDataForQuest(questId: string): Promise<WikiQuestDocument | null> {
  try {
    return await getWikiQuestData(questId)
  } catch (error) {
    console.error(`Error getting wiki data for quest ${questId}:`, error)
    return null
  }
}

/**
 * Check if a quest has wiki data available
 */
export async function hasWikiData(questId: string): Promise<boolean> {
  const wikiData = await getWikiQuestData(questId)
  return wikiData !== null
}

