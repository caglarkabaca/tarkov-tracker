/**
 * Convert Wiki Quest Data to Task format (Tarkov API compatible)
 */

import type { Task } from './questTree'
import type { WikiQuestData } from '../types/wiki'

/**
 * Generate quest ID from quest name (normalized)
 */
function generateQuestId(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Normalize quest name for matching
 */
function normalizeQuestName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Check if two quest names match (fuzzy matching)
 */
function questNamesMatch(name1: string, name2: string): boolean {
  const normalized1 = normalizeQuestName(name1)
  const normalized2 = normalizeQuestName(name2)
  
  // Exact match
  if (normalized1 === normalized2) return true
  
  // One contains the other (for cases like "The Punisher - Part 1" vs "The Punisher Part 1")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Check if the difference is just punctuation/spaces
    const diff = normalized1.replace(normalized2, '') || normalized2.replace(normalized1, '')
    if (diff.trim().length <= 5) { // Allow small differences
      return true
    }
  }
  
  // Check if they're similar enough (after removing common words)
  const words1 = normalized1.split(/\s+/).filter(w => w.length > 2)
  const words2 = normalized2.split(/\s+/).filter(w => w.length > 2)
  
  // Remove common words that don't help matching
  const commonWords = ['the', 'part', 'quest', 'mission', 'task']
  const filtered1 = words1.filter(w => !commonWords.includes(w))
  const filtered2 = words2.filter(w => !commonWords.includes(w))
  
  if (filtered1.length === 0 || filtered2.length === 0) return false
  
  // Check if most words match
  const matchingWords = filtered1.filter(w => filtered2.includes(w))
  const matchRatio = matchingWords.length / Math.max(filtered1.length, filtered2.length)
  
  return matchRatio >= 0.7 // 70% of words must match
}

/**
 * Convert WikiQuestData to Task format
 * Maps wiki data to Tarkov API Task structure
 */
export function convertWikiQuestToTask(
  wikiData: WikiQuestData,
  traders: Array<{ id: string; name: string; normalizedName?: string; image4xLink?: string }> = [],
  allWikiQuests: WikiQuestData[] = []
): Task {
  const questId = wikiData.questId || generateQuestId(wikiData.questName)
  const normalizedName = normalizeQuestName(wikiData.questName)

  // Find trader by name
  const trader = wikiData.givenBy
    ? traders.find(
        (t) =>
          t.name.toLowerCase() === wikiData.givenBy?.toLowerCase() ||
          t.normalizedName?.toLowerCase() === normalizeQuestName(wikiData.givenBy || '').replace(/\s+/g, '')
      )
    : undefined

  // Build task requirements from previous quests
  // Priority: Use links if available (more reliable), otherwise fall back to name matching
  const taskRequirements: Array<{
    task: {
      id: string
      name: string
      normalizedName: string
      trader?: { id: string; name: string }
    }
    status: string[]
  }> = []

  // First, try to match using links (more reliable)
  if (wikiData.previousQuestLinks && wikiData.previousQuestLinks.length > 0) {
    for (const prevQuestLink of wikiData.previousQuestLinks) {
      // Find the previous quest by matching wikiUrl
      const prevQuest = allWikiQuests.find(
        (q) => q.wikiUrl && q.wikiUrl === prevQuestLink.wikiUrl
      )

      if (prevQuest) {
        const prevQuestId = prevQuest.questId || generateQuestId(prevQuestLink.name)
        const prevQuestNormalizedName = normalizeQuestName(prevQuestLink.name)

        // Find trader for previous quest
        const prevTrader = prevQuest.givenBy
          ? traders.find(
              (t) =>
                t.name.toLowerCase() === prevQuest.givenBy?.toLowerCase() ||
                t.normalizedName?.toLowerCase() === normalizeQuestName(prevQuest.givenBy || '').replace(/\s+/g, '')
            )
          : undefined

        taskRequirements.push({
          task: {
            id: prevQuestId,
            name: prevQuestLink.name,
            normalizedName: prevQuestNormalizedName,
            trader: prevTrader
              ? {
                  id: prevTrader.id,
                  name: prevTrader.name,
                }
              : undefined,
          },
          status: ['Started', 'AvailableForStart'] as string[],
        })
      }
    }
  }

  // Fallback: If no links or some links didn't match, use name matching
  if (wikiData.previousQuests && (taskRequirements.length === 0 || taskRequirements.length < (wikiData.previousQuests.length || 0))) {
    const matchedNames = new Set(taskRequirements.map(req => req.task.name.toLowerCase()))
    
    for (const prevQuestName of wikiData.previousQuests) {
      // Skip if already matched via link
      if (matchedNames.has(prevQuestName.toLowerCase())) {
        continue
      }

      // Find the previous quest in all wiki quests using fuzzy matching
      const prevQuest = allWikiQuests.find(
        (q) => questNamesMatch(q.questName, prevQuestName)
      )

      if (prevQuest) {
        const prevQuestId = prevQuest.questId || generateQuestId(prevQuestName)
        const prevQuestNormalizedName = normalizeQuestName(prevQuestName)

        // Find trader for previous quest
        const prevTrader = prevQuest.givenBy
          ? traders.find(
              (t) =>
                t.name.toLowerCase() === prevQuest.givenBy?.toLowerCase() ||
                t.normalizedName?.toLowerCase() === normalizeQuestName(prevQuest.givenBy || '').replace(/\s+/g, '')
            )
          : undefined

        taskRequirements.push({
          task: {
            id: prevQuestId,
            name: prevQuestName,
            normalizedName: prevQuestNormalizedName,
            trader: prevTrader
              ? {
                  id: prevTrader.id,
                  name: prevTrader.name,
                }
              : undefined,
          },
          status: ['Started', 'AvailableForStart'] as string[],
        })
      }
    }
  }

  // Build trader requirements (if we can extract from requirements text)
  const traderRequirements: Array<{
    trader: { id: string; name: string }
    level: number
  }> = []

  // Build finish rewards from wiki rewards data
  const finishRewards: Task['finishRewards'] = {
    traderStanding: wikiData.rewardsRep?.map((rep) => {
      const repTrader = traders.find(
        (t) =>
          t.name.toLowerCase() === rep.trader.toLowerCase() ||
          t.normalizedName?.toLowerCase() === normalizeQuestName(rep.trader).replace(/\s+/g, '')
      )

      return {
        trader: {
          id: repTrader?.id || rep.trader.toLowerCase().replace(/\s+/g, '-'),
          name: repTrader?.name || rep.trader,
        },
        standing: rep.amount,
      }
    }),
  }

  // Build task object
  const task: Task = {
    id: questId,
    name: wikiData.questName,
    normalizedName,
    minPlayerLevel: wikiData.minPlayerLevel,
    experience: wikiData.rewardsExp,
    taskImageLink: wikiData.questImage || undefined,
    wikiLink: wikiData.wikiUrl,
    restartable: false, // Wiki doesn't have this info, default to false
    kappaRequired: wikiData.kappaRequired || false,
    lightkeeperRequired: wikiData.lightkeeperRequired || false,
    map: wikiData.location
      ? {
          id: wikiData.location.toLowerCase().replace(/\s+/g, '-'),
          name: wikiData.location,
          normalizedName: normalizeQuestName(wikiData.location).replace(/\s+/g, ''),
        }
      : undefined,
    trader: trader
      ? {
          id: trader.id,
          name: trader.name,
          normalizedName: trader.normalizedName || normalizeQuestName(trader.name).replace(/\s+/g, ''),
          image4xLink: trader.image4xLink,
        }
      : undefined,
    traderRequirements: traderRequirements.length > 0 ? traderRequirements : undefined,
    taskRequirements: taskRequirements.length > 0 ? taskRequirements : undefined,
    objectives: wikiData.objectives?.map(obj => ({
      id: obj.id,
      type: obj.type,
      description: obj.description,
      optional: obj.optional || false,
      maps: obj.maps?.map(mapName => {
        const normalizedMapName = normalizeQuestName(mapName).replace(/\s+/g, '')
        return {
          id: mapName.toLowerCase().replace(/\s+/g, '-'),
          name: mapName,
          normalizedName: normalizedMapName,
        }
      }),
    })),
    guideSteps: wikiData.guideSteps && wikiData.guideSteps.length > 0 ? wikiData.guideSteps : undefined,
    startRewards: undefined, // Wiki doesn't have start rewards
    finishRewards: finishRewards.traderStanding && finishRewards.traderStanding.length > 0 ? finishRewards : undefined,
    failureOutcome: undefined, // Wiki doesn't have failure outcome
  }

  return task
}

/**
 * Convert multiple WikiQuestData items to Task array
 */
export function convertWikiQuestsToTasks(
  wikiQuests: WikiQuestData[],
  traders: Array<{ id: string; name: string; normalizedName?: string; image4xLink?: string }> = []
): Task[] {
  return wikiQuests.map((wikiQuest) => convertWikiQuestToTask(wikiQuest, traders, wikiQuests))
}

