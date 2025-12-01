/**
 * Quest tree utility functions
 */

export interface TaskWithChildren extends Task {
  children: TaskWithChildren[]
  depth: number
}

export interface Task {
  id: string
  name: string
  normalizedName?: string
  minPlayerLevel?: number
  experience?: number
  taskImageLink?: string
  restartable?: boolean
  kappaRequired?: boolean
  lightkeeperRequired?: boolean
  map?: {
    id: string
    name: string
    normalizedName?: string
  }
  trader?: {
    id: string
    name: string
    normalizedName?: string
    image4xLink?: string
  }
  traderRequirements?: Array<{
    trader: {
      id: string
      name: string
    }
    level: number
  }>
  taskRequirements?: Array<{
    task: {
      trader?: {
        id: string
        name: string
      }
      id: string
      name: string
      normalizedName?: string
    }
    status: string | string[]
  }>
  objectives?: Array<{
    id: string
    type: string
    description?: string
    optional: boolean
    maps?: Array<{
      id: string
      name: string
      normalizedName?: string
    }>
  }>
  startRewards?: {
    items?: Array<{
      item: {
        id: string
        name: string
        normalizedName?: string
        imageLink?: string
        image512pxLink?: string
        image8xLink?: string
      }
      count: number
    }>
    traderStanding?: Array<{
      trader: {
        id: string
        name: string
      }
      standing: number
    }>
  }
  finishRewards?: {
    items?: Array<{
      item: {
        id: string
        name: string
        normalizedName?: string
        imageLink?: string
        image512pxLink?: string
        image8xLink?: string
      }
      count: number
    }>
    traderStanding?: Array<{
      trader: {
        id: string
        name: string
      }
      standing: number
    }>
  }
  failureOutcome?: {
    items?: Array<{
      item: {
        id: string
        name: string
        normalizedName?: string
        imageLink?: string
        image512pxLink?: string
        image8xLink?: string
      }
      count: number
    }>
    traderStanding?: Array<{
      trader: {
        id: string
        name: string
      }
      standing: number
    }>
  }
  wikiLink?: string
}

/**
 * Build a tree structure from flat quest list
 * Quest requirements (taskRequirements) define parent-child relationships
 */
export function buildQuestTree(tasks: Task[]): TaskWithChildren[] {
  // Create a map of all tasks by ID
  const taskMap = new Map<string, Task>()
  tasks.forEach(task => {
    taskMap.set(task.id, task)
  })

  // Create a map to track which tasks have parents
  const hasParent = new Set<string>()
  
  // Build parent-child relationships
  tasks.forEach(task => {
    if (task.taskRequirements && task.taskRequirements.length > 0) {
      task.taskRequirements.forEach(req => {
        if (req.task?.id) {
          hasParent.add(task.id) // This task has a parent
        }
      })
    }
  })

  // Find root tasks (tasks that are not children of any other task)
  const rootTasks: TaskWithChildren[] = []
  
  tasks.forEach(task => {
    if (!hasParent.has(task.id)) {
      rootTasks.push({
        ...task,
        children: [],
        depth: 0,
      })
    }
  })

  // Build the tree recursively
  function buildChildren(parentId: string, depth: number): TaskWithChildren[] {
    const children: TaskWithChildren[] = []
    
    tasks.forEach(task => {
      const isChild = task.taskRequirements?.some(
        req => req.task?.id === parentId
      )
      
      if (isChild) {
        children.push({
          ...task,
          children: buildChildren(task.id, depth + 1),
          depth: depth + 1,
        })
      }
    })

    return children
  }

  // Add children to root tasks
  rootTasks.forEach(rootTask => {
    rootTask.children = buildChildren(rootTask.id, 1)
  })

  return rootTasks
}

/**
 * Filter quests by trader ID
 */
export function filterQuestsByTrader(
  tasks: Task[],
  traderId: string | null
): Task[] {
  if (!traderId) {
    return tasks
  }

  return tasks.filter(task => task.trader?.id === traderId)
}

/**
 * Normalize map name for comparison
 */
function normalizeMapName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Filter quests by map name
 */
export function filterQuestsByMap(
  tasks: Task[],
  mapId: string | null
): Task[] {
  if (!mapId) {
    return tasks
  }

  const normalizedMapId = normalizeMapName(mapId)

  return tasks.filter(task => {
    if (!task.map) return false
    
    const questMapNormalized = normalizeMapName(task.map.name)
    return (
      questMapNormalized === normalizedMapId ||
      questMapNormalized.includes(normalizedMapId) ||
      normalizedMapId.includes(questMapNormalized)
    )
  })
}

/**
 * Flatten tree structure back to array (useful for filtering)
 */
export function flattenQuestTree(tree: TaskWithChildren[]): TaskWithChildren[] {
  const result: TaskWithChildren[] = []
  
  function traverse(node: TaskWithChildren) {
    result.push(node)
    node.children.forEach(child => traverse(child))
  }
  
  tree.forEach(root => traverse(root))
  return result
}

/**
 * Filter quests by player level
 * Returns quests that can be taken at the given level
 */
export function filterQuestsByLevel(tasks: Task[], playerLevel: number): Task[] {
  return tasks.filter(task => {
    // If no level requirement, it's available
    if (!task.minPlayerLevel) {
      return true
    }
    // Quest is available if player level meets requirement
    return playerLevel >= task.minPlayerLevel
  })
}

/**
 * Sort quests: available quests first, then by level requirement
 */
export function sortQuestsByAvailability(tasks: Task[], playerLevel: number): Task[] {
  return [...tasks].sort((a, b) => {
    const aAvailable = !a.minPlayerLevel || playerLevel >= a.minPlayerLevel
    const bAvailable = !b.minPlayerLevel || playerLevel >= b.minPlayerLevel
    
    // Available quests first
    if (aAvailable && !bAvailable) return -1
    if (!aAvailable && bAvailable) return 1
    
    // If both available or both unavailable, sort by level requirement
    const aLevel = a.minPlayerLevel || 0
    const bLevel = b.minPlayerLevel || 0
    
    return aLevel - bLevel
  })
}

/**
 * Check if quest can be taken at given level
 */
export function canTakeQuest(task: Task, playerLevel: number): boolean {
  if (!task.minPlayerLevel) return true
  return playerLevel >= task.minPlayerLevel
}
