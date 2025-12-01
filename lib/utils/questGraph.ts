/**
 * Quest graph utilities for React Flow visualization
 */

import type { Task } from './questTree'
import type { Node, Edge } from '@xyflow/react'

export interface QuestNodeData extends Record<string, unknown> {
  quest: Task
  isCompleted: boolean
  isIsolated: boolean
  playerLevel?: number
}

/**
 * Build graph structure from quests for React Flow
 * Groups quests by their dependency levels
 */
export function buildQuestGraph(quests: Task[], doneQuestIds: Set<string>, playerLevel: number = 1): { nodes: Node<QuestNodeData>[], edges: Edge[] } {
  const nodes: Node<QuestNodeData>[] = []
  const edges: Edge[] = []
  const questMap = new Map<string, Task>()
  
  quests.forEach(quest => {
    questMap.set(quest.id, quest)
  })

  // Calculate dependency levels
  const levels = new Map<string, number>()
  
  function getLevel(questId: string, visited: Set<string> = new Set()): number {
    if (visited.has(questId)) {
      return levels.get(questId) || 0 // Already calculated or circular dependency
    }
    
    if (levels.has(questId)) {
      return levels.get(questId)!
    }

    const quest = questMap.get(questId)
    if (!quest || !quest.taskRequirements || quest.taskRequirements.length === 0) {
      levels.set(questId, 0)
      return 0
    }

    visited.add(questId)
    
    // Get levels of prerequisite quests that exist in current quest set
    const parentLevels = (quest.taskRequirements || [])
      .map(req => req.task?.id)
      .filter((id): id is string => !!id && questMap.has(id))
      .map(parentId => getLevel(parentId, visited))
    
    // If quest has prerequisites but none exist in current set, treat as level 0 (root level)
    // but mark as connected so it appears in the connected quests area
    if (parentLevels.length === 0) {
      // This quest has prerequisites from other traders, put it at level 0 but still connected
      levels.set(questId, 0)
      return 0
    }

    const maxParentLevel = Math.max(...parentLevels)
    const level = maxParentLevel + 1
    levels.set(questId, level)
    return level
  }

  // Calculate levels for all quests
  quests.forEach(quest => {
    getLevel(quest.id)
  })

  // Find which quests are required by other quests (dependent quests)
  const requiredByQuests = new Set<string>()
  quests.forEach(quest => {
    if (quest.taskRequirements && quest.taskRequirements.length > 0) {
      quest.taskRequirements.forEach(req => {
        if (req.task?.id && questMap.has(req.task.id)) {
          requiredByQuests.add(req.task.id)
        }
      })
    }
  })

  // Identify isolated quests (no requirements at all, and not required by anyone)
  // Connected quests: have any requirements (even from other traders) OR are required by others
  const isolatedQuests = new Set<string>()
  const connectedQuests = new Set<string>()
  
  quests.forEach(quest => {
    // Check if quest has any requirements at all (even from other traders/quests not in current set)
    const hasAnyRequirements = quest.taskRequirements && quest.taskRequirements.length > 0
    
    // Check if quest has valid requirements (requirements that exist in current quest set)
    const hasValidRequirements = hasAnyRequirements && 
      (quest.taskRequirements || []).some(req => req.task?.id && questMap.has(req.task.id))
    
    const isNotRequired = !requiredByQuests.has(quest.id)
    
    // Isolated if: no requirements at all AND not required by anyone
    // Connected if: 
    //   - has any requirements (even from other traders/quests not in current set) OR
    //   - is required by others OR
    //   - has requirements that exist in current quest set
    if (!hasAnyRequirements && isNotRequired) {
      isolatedQuests.add(quest.id)
    } else {
      // If quest has prerequisites (even from other traders), mark as connected
      connectedQuests.add(quest.id)
    }
  })

  // Group by level, separating isolated and connected quests
  const isolatedByLevel = new Map<number, Task[]>()
  const connectedByLevel = new Map<number, Task[]>()
  
  quests.forEach(quest => {
    const level = levels.get(quest.id) || 0
    if (isolatedQuests.has(quest.id)) {
      if (!isolatedByLevel.has(level)) {
        isolatedByLevel.set(level, [])
      }
      isolatedByLevel.get(level)!.push(quest)
    } else {
      if (!connectedByLevel.has(level)) {
        connectedByLevel.set(level, [])
      }
      connectedByLevel.get(level)!.push(quest)
    }
  })

  // Calculate max level only for connected quests
  const maxConnectedLevel = connectedByLevel.size > 0 
    ? Math.max(...Array.from(connectedByLevel.keys()), 0)
    : 0
  
  const levelWidth = 300
  const nodeHeight = 100
  const isolatedXStart = 50
  const connectedXStart = 400

  // Calculate max nodes for height calculation (consider both groups)
  const allQuests = Array.from(isolatedByLevel.values()).concat(Array.from(connectedByLevel.values()))
  const maxNodesInLevel = allQuests.length > 0 
    ? Math.max(...allQuests.map(quests => quests.length), 1)
    : 1
  
  // Position isolated quests on the left
  isolatedByLevel.forEach((levelQuests) => {
    if (levelQuests.length === 0) return
    
    const baseY = 50
    const spacing = 120
    
    levelQuests.forEach((quest, index) => {
      const x = Number(isolatedXStart) || 50
      const y = Number(baseY) + (Number(index) * Number(spacing))
      
      // Ensure values are valid numbers
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.warn(`Invalid position for isolated quest ${quest.id}: x=${x}, y=${y}`)
        return
      }
      
      nodes.push({
        id: quest.id,
        type: 'questNode',
        position: { x: Math.round(x), y: Math.round(y) },
        data: {
          quest,
          isCompleted: doneQuestIds.has(quest.id),
          isIsolated: true,
          playerLevel,
        },
      })
    })
  })

  // Position connected quests starting from x: 400
  connectedByLevel.forEach((levelQuests, level) => {
    if (levelQuests.length === 0) return
    
    const x = Number(connectedXStart) + (Number(level) * Number(levelWidth))
    const baseY = 50
    const spacing = 120
    
    levelQuests.forEach((quest, index) => {
      const y = Number(baseY) + (Number(index) * Number(spacing))
      
      // Ensure values are valid numbers
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.warn(`Invalid position for connected quest ${quest.id}: x=${x}, y=${y}`)
        return
      }
      
      nodes.push({
        id: quest.id,
        type: 'questNode',
        position: { x: Math.round(x), y: Math.round(y) },
        data: {
          quest,
          isCompleted: doneQuestIds.has(quest.id),
          isIsolated: false,
          playerLevel,
        },
      })

      // Add edges
      if (quest.taskRequirements && quest.taskRequirements.length > 0) {
        quest.taskRequirements.forEach(req => {
          if (req.task?.id && questMap.has(req.task.id)) {
            edges.push({
              id: `${req.task.id}-${quest.id}`,
              source: req.task.id,
              target: quest.id,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#4b5563', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
                color: '#4b5563',
              },
            })
          }
        })
      }
    })
  })

  return {
    nodes,
    edges,
  }
}