'use client'

import { Card, Text, YStack } from 'tamagui'

interface TraderCardProps {
  trader: {
    id: string
    name: string
    image4xLink?: string
  }
  isSelected: boolean
  questCount: number
  onPress: () => void
}

export function TraderCard({ trader, isSelected, questCount, onPress }: TraderCardProps) {
  return (
    <Card
      elevate
      size="$2"
      bordered
      padding="$2"
      backgroundColor={isSelected ? '$blue3' : '$background'}
      borderColor={isSelected ? '$blue8' : '$borderColor'}
      borderWidth={isSelected ? 2 : 1}
      cursor="pointer"
      pressStyle={{ scale: 0.95 }}
      onPress={onPress}
      width={100}
      height={120}
      alignItems="center"
      justifyContent="center"
      gap="$2"
    >
      {trader.image4xLink ? (
        <Card
          size="$1"
          bordered
          overflow="hidden"
          width={60}
          height={60}
        >
          <img
            src={trader.image4xLink}
            alt={trader.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Card>
      ) : (
        <YStack
          width={60}
          height={60}
          backgroundColor="$gray5"
          borderRadius="$2"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="$3" color="$color10">
            {trader.name.charAt(0)}
          </Text>
        </YStack>
      )}
      <YStack alignItems="center" gap="$1">
        <Text fontSize="$2" fontWeight="600" textAlign="center" numberOfLines={2}>
          {trader.name}
        </Text>
        <Text fontSize="$1" color="$color10">
          {questCount}
        </Text>
      </YStack>
    </Card>
  )
}

