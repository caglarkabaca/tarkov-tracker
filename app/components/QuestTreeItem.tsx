'use client'

import { useState } from 'react'
import { Button, Card, Text, XStack, YStack } from 'tamagui'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { TaskWithChildren } from '@/lib/utils/questTree'
import { canTakeQuest } from '@/lib/utils/questTree'

interface QuestTreeItemProps {
  quest: TaskWithChildren
  playerLevel: number
  onToggle?: () => void
}

export function QuestTreeItem({ quest, playerLevel, onToggle }: QuestTreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isAvailable = canTakeQuest(quest, playerLevel)
  const hasChildren = quest.children && quest.children.length > 0
  const indentLevel = quest.depth * 16

  const toggleExpanded = () => {
    setExpanded(!expanded)
    onToggle?.()
  }

  return (
    <YStack>
      <Card
        elevate
        size="$2"
        bordered
        padding="$2"
        backgroundColor={isAvailable ? '$background' : '$gray3'}
        borderColor={isAvailable ? '$borderColor' : '$gray6'}
        width="100%"
        marginLeft={indentLevel}
        marginBottom="$1"
        opacity={isAvailable ? 1 : 0.6}
      >
        <XStack gap="$2" alignItems="flex-start" justifyContent="space-between">
          <YStack flex={1} gap="$1">
            <XStack gap="$1" alignItems="center">
              {hasChildren && (
                <Button
                  size="$1"
                  circular
                  chromeless
                  onPress={toggleExpanded}
                  padding={0}
                  minWidth={20}
                  width={20}
                  height={20}
                >
                  {expanded ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </Button>
              )}
              {!hasChildren && <XStack width={20} />}
              
              <YStack flex={1}>
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <Text fontSize="$3" fontWeight="600" color="$color12">
                    {quest.name}
                  </Text>
                  {!isAvailable && quest.minPlayerLevel && (
                    <Text fontSize="$1" color="$orange10" backgroundColor="$orange3" paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                      Lv.{quest.minPlayerLevel}
                    </Text>
                  )}
                  {isAvailable && (
                    <Text fontSize="$1" color="$green10" backgroundColor="$green3" paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                      ✓ Mevcut
                    </Text>
                  )}
                </XStack>
                
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  {quest.trader && (
                    <Text fontSize="$1" color="$color10">
                      {quest.trader.name}
                    </Text>
                  )}
                  {quest.map && (
                    <Text fontSize="$1" color="$color10">
                      {quest.map.name}
                    </Text>
                  )}
                  {quest.minPlayerLevel && (
                    <Text fontSize="$1" color="$color10">
                      Lv.{quest.minPlayerLevel}
                    </Text>
                  )}
                </XStack>
              </YStack>
            </XStack>
          </YStack>
          
          {quest.taskImageLink && (
            <Card
              size="$1"
              bordered
              overflow="hidden"
              width={50}
              height={50}
              cursor="pointer"
              pressStyle={{ scale: 0.9 }}
              onPress={() => window.open(quest.wikiLink || quest.taskImageLink, '_blank')}
            >
              <img
                src={quest.taskImageLink}
                alt={quest.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Card>
          )}
        </XStack>

        {quest.objectives && quest.objectives.length > 0 && expanded && (
          <YStack gap="$1" paddingLeft="$5" marginTop="$1">
            <Text fontWeight="600" fontSize="$2" color="$color12">
              Objectives:
            </Text>
            {quest.objectives.slice(0, 2).map((objective) => (
              <Text
                key={objective.id}
                fontSize="$1"
                color={objective.optional ? '$color10' : '$color11'}
                paddingLeft="$2"
              >
                {objective.optional && '(Optional) '}
                {objective.description || objective.type}
              </Text>
            ))}
            {quest.objectives.length > 2 && (
              <Text fontSize="$1" color="$color10" paddingLeft="$2">
                +{quest.objectives.length - 2} more
              </Text>
            )}
          </YStack>
        )}
      </Card>

      {hasChildren && expanded && (
        <YStack>
          {quest.children.map((child) => (
            <QuestTreeItem 
              key={child.id} 
              quest={child} 
              playerLevel={playerLevel}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
}
