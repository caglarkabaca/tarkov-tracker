'use client'

import { Card, Text, XStack, YStack, Button } from 'tamagui'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import type { Task } from '@/lib/utils/questTree'
import { canTakeQuest } from '@/lib/utils/questTree'

interface QuestCardProps {
  quest: Task
  playerLevel: number
  isDone: boolean
  isUnlocked: boolean
  onToggleDone: () => void
  onPress?: () => void
}

export function QuestCard({ quest, playerLevel, isDone, isUnlocked, onToggleDone, onPress }: QuestCardProps) {
  const isAvailable = canTakeQuest(quest, playerLevel)
  const isLocked = !isUnlocked && quest.taskRequirements && quest.taskRequirements.length > 0

  return (
    <Card
      elevate
      size="$2"
      bordered
      padding="$2"
      backgroundColor={isDone ? '$green2' : isLocked ? '$gray3' : isAvailable ? '$background' : '$gray4'}
      borderColor={isDone ? '$green8' : isLocked ? '$gray8' : isAvailable ? '$borderColor' : '$gray7'}
      borderWidth={isDone ? 2 : 1}
      opacity={isLocked ? 0.5 : 1}
      cursor="pointer"
      pressStyle={{ scale: 0.98 }}
      width="100%"
      height="100%"
      onPress={onPress}
    >
      <YStack gap="$1.5" flex={1}>
        {/* Image and Checkbox */}
        <XStack gap="$2" alignItems="flex-start" justifyContent="space-between">
          {quest.taskImageLink && (
            <Card
              size="$1"
              bordered
              overflow="hidden"
              width={60}
              height={60}
              cursor="pointer"
              pressStyle={{ scale: 0.9 }}
              onPress={(e) => {
                e.stopPropagation()
                quest.wikiLink && window.open(quest.wikiLink, '_blank')
              }}
            >
              <img
                src={quest.taskImageLink}
                alt={quest.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Card>
          )}
          
          <Button
            size="$2"
            circular
            chromeless
            onPress={(e) => {
              e.stopPropagation()
              onToggleDone()
            }}
            disabled={isLocked}
            opacity={isLocked ? 0.3 : 1}
          >
            {isDone ? (
              <CheckCircle2 size={20} color="green" />
            ) : (
              <Circle size={20} />
            )}
          </Button>
        </XStack>

        {/* Quest Info */}
        <YStack gap="$1" flex={1}>
          <Text fontSize="$2" fontWeight="600" color="$color12" numberOfLines={2}>
            {quest.name}
          </Text>
          
          <XStack gap="$1" alignItems="center" flexWrap="wrap">
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
          </XStack>

          <XStack gap="$1" alignItems="center" flexWrap="wrap">
            {quest.minPlayerLevel && (
              <Text fontSize="$1" color={isAvailable ? '$green10' : '$orange10'} backgroundColor={isAvailable ? '$green3' : '$orange3'} paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                Lv.{quest.minPlayerLevel}
              </Text>
            )}
            {isLocked && (
              <Text fontSize="$1" color="$gray10" backgroundColor="$gray5" paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                🔒 Locked
              </Text>
            )}
            {isDone && (
              <Text fontSize="$1" color="$green10" backgroundColor="$green3" paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                ✓ Done
              </Text>
            )}
            {quest.experience && (
              <Text fontSize="$1" color="$blue10" backgroundColor="$blue3" paddingHorizontal="$1" paddingVertical="$0.5" borderRadius="$1">
                +{quest.experience.toLocaleString()} XP
              </Text>
            )}
          </XStack>

          {quest.objectives && quest.objectives.length > 0 && (
            <Text fontSize="$1" color="$color10" numberOfLines={1}>
              {quest.objectives.length} objective{quest.objectives.length > 1 ? 's' : ''}
            </Text>
          )}
        </YStack>

        {/* Wiki Link */}
        {quest.wikiLink && (
          <Button
            size="$1"
            theme="blue"
            onPress={(e) => {
              e.stopPropagation()
              window.open(quest.wikiLink, '_blank')
            }}
            alignSelf="flex-start"
          >
            <XStack gap="$1" alignItems="center">
              <ExternalLink size={12} />
              <Text fontSize="$1">Wiki</Text>
            </XStack>
          </Button>
        )}
      </YStack>
    </Card>
  )
}
