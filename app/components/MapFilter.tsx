'use client'

import { useMemo } from 'react'
import { Card, Text, XStack, YStack, Button } from 'tamagui'
import type { Task } from '@/lib/utils/questTree'
import { filterQuestsByTrader, filterQuestsByLevel } from '@/lib/utils/questTree'
import { isQuestUnlocked } from '@/lib/utils/questProgress'

interface MapFilterProps {
  quests: Task[]
  selectedMap: string | null
  onMapSelect: (mapId: string | null) => void
  selectedTrader: string | null
  playerLevel: number
  doneQuestIds: Set<string>
}

interface MapInfo {
  id: string
  name: string
  position: { top: string; left: string }
  aliases?: string[] // Alternative names for matching
}

// Map positions on the image (relative percentages) - Updated based on actual locations
const MAP_POSITIONS: MapInfo[] = [
  { 
    id: 'ground-zero', 
    name: 'Ground Zero', 
    position: { top: '15%', left: '80%' },
    aliases: ['ground-zero', 'ground zero', 'groundzero']
  },
  { 
    id: 'streets-of-tarkov', 
    name: 'Streets of Tarkov', 
    position: { top: '25%', left: '75%' },
    aliases: ['streets', 'streets-of-tarkov', 'streets of tarkov', 'street']
  },
  { 
    id: 'woods', 
    name: 'Woods', 
    position: { top: '22%', left: '42%' },
    aliases: ['woods']
  },
  { 
    id: 'factory', 
    name: 'Factory', 
    position: { top: '47%', left: '43%' },
    aliases: ['factory']
  },
  { 
    id: 'interchange', 
    name: 'Interchange', 
    position: { top: '49%', left: '60%' },
    aliases: ['interchange']
  },
  { 
    id: 'customs', 
    name: 'Customs', 
    position: { top: '59%', left: '40%' },
    aliases: ['customs']
  },
  { 
    id: 'reserve', 
    name: 'Reserve', 
    position: { top: '47%', left: '27%' },
    aliases: ['reserve']
  },
  { 
    id: 'lighthouse', 
    name: 'Lighthouse', 
    position: { top: '38%', left: '8%' },
    aliases: ['lighthouse']
  },
  { 
    id: 'shoreline', 
    name: 'Shoreline', 
    position: { top: '68%', left: '10%' },
    aliases: ['shoreline']
  },
]

export function MapFilter({ 
  quests, 
  selectedMap, 
  onMapSelect,
  selectedTrader,
  playerLevel,
  doneQuestIds
}: MapFilterProps) {
  // Normalize map names for matching
  const normalizeMapName = (name: string): string => {
    return name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  // Apply filters to quests - only show NOT DONE quests for badge counts
  const filteredQuests = useMemo(() => {
    let filtered = quests

    // Filter by trader
    if (selectedTrader) {
      filtered = filterQuestsByTrader(filtered, selectedTrader)
    }

    // Filter by level
    filtered = filterQuestsByLevel(filtered, playerLevel)

    // Filter by unlocked status
    filtered = filtered.filter(q => isQuestUnlocked(q, doneQuestIds))

    // Filter out completed quests for badge count
    filtered = filtered.filter(q => !doneQuestIds.has(q.id))

    return filtered
  }, [quests, selectedTrader, playerLevel, doneQuestIds])

  // Get all unique maps from filtered quests with their counts and matched positions
  const mappedQuests = useMemo(() => {
    const mapCounts = new Map<string, { name: string; count: number; position: MapInfo | null }>()
    
    filteredQuests.forEach(quest => {
      if (quest.map) {
        const mapName = quest.map.name
        const normalized = normalizeMapName(mapName)
        
        if (!mapCounts.has(normalized)) {
          // Find matching position
          let position: MapInfo | null = null
          
          // Try exact match first
          position = MAP_POSITIONS.find(m => normalizeMapName(m.name) === normalized) || null
          
          // Try alias match
          if (!position) {
            position = MAP_POSITIONS.find(m => {
              if (m.aliases) {
                return m.aliases.some(alias => normalizeMapName(alias) === normalized)
              }
              return false
            }) || null
          }
          
          // Try partial match
          if (!position) {
            position = MAP_POSITIONS.find(m => {
              const mapNormalized = normalizeMapName(m.name)
              return (
                mapNormalized.includes(normalized) || 
                normalized.includes(mapNormalized)
              )
            }) || null
          }
          
          mapCounts.set(normalized, { name: mapName, count: 0, position })
        }
        
        const existing = mapCounts.get(normalized)!
        existing.count++
      }
    })

    return Array.from(mapCounts.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
        position: data.position,
        mapId: data.position?.id || id, // Use position ID for filtering
      }))
      .filter(item => item.position !== null) // Only show maps that have positions
  }, [filteredQuests])

  const handleMapClick = (mapId: string) => {
    if (selectedMap === mapId) {
      onMapSelect(null)
    } else {
      onMapSelect(mapId)
    }
  }

  return (
    <Card
      size="$4"
      bordered
      backgroundColor="$background"
      overflow="hidden"
      position="relative"
      width="100%"
      minHeight={750}
    >
      <YStack position="relative" width="100%" minHeight={750}>
        {/* Map Image */}
        <img
          src="/full_map.jpeg"
          alt="Tarkov Map"
          style={{
            width: '100%',
            height: 'auto',
            minHeight: 750,
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {/* Map Badges Overlay */}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
        >
          {mappedQuests.map((map) => {
            if (!map.position) return null

            const isSelected = selectedMap === map.mapId
            const count = map.count

            return (
              <XStack
                key={map.id}
                position="absolute"
                top={map.position.position.top}
                left={map.position.position.left}
                pointerEvents="auto"
                cursor="pointer"
                zIndex={10}
              >
                <Button
                  size="$2"
                  chromeless
                  backgroundColor={isSelected ? '$blue5' : '$background'}
                  borderColor={isSelected ? '$blue9' : '$borderColor'}
                  borderWidth={isSelected ? 2 : 1}
                  opacity={0.95}
                  cursor="pointer"
                  pressStyle={{ scale: 0.95, opacity: 0.8 }}
                  onPress={() => handleMapClick(map.mapId)}
                  paddingHorizontal="$2"
                  paddingVertical="$1.5"
                >
                  <XStack gap="$1.5" alignItems="center">
                    <Text
                      fontSize="$2"
                      fontWeight="600"
                      color={isSelected ? '$blue12' : '$color12'}
                      numberOfLines={1}
                      maxWidth={130}
                    >
                      {map.name}
                    </Text>
                    <Card
                      size="$1"
                      backgroundColor={isSelected ? '$blue9' : '$blue5'}
                      paddingHorizontal="$1.5"
                      paddingVertical="$0.5"
                      borderRadius="$2"
                    >
                      <Text
                        fontSize="$1"
                        fontWeight="700"
                        color={isSelected ? '$blue1' : '$blue12'}
                      >
                        {count}
                      </Text>
                    </Card>
                  </XStack>
                </Button>
              </XStack>
            )
          })}
        </YStack>
      </YStack>
    </Card>
  )
}
