'use client'

import { Text, XStack, YStack } from 'tamagui'
import Link from 'next/link'

const VERSION = '0.2.1-beta'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <YStack
      backgroundColor="$background"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      padding="$4"
      gap="$2"
      alignItems="center"
      marginTop="auto"
    >
      <XStack gap="$3" alignItems="center" flexWrap="wrap" justifyContent="center">
        <Text fontSize="$1" color="$color10">
          © {currentYear} caca's Tarkov Tracker
        </Text>
        <Text fontSize="$1" color="$color10">
          •
        </Text>
        <Text fontSize="$1" color="$color10">
          v{VERSION}
        </Text>
        <Text fontSize="$1" color="$color10">
          •
        </Text>
        <Link href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="license noopener noreferrer">
          <Text fontSize="$1" color="$color11" hoverStyle={{ textDecorationLine: 'underline' }}>
            GNU GPLv3
          </Text>
        </Link>
        <Text fontSize="$1" color="$color10">
          •
        </Text>
        <Link href="https://api.tarkov.dev/" target="_blank" rel="noopener noreferrer">
          <Text fontSize="$1" color="$color11" hoverStyle={{ textDecorationLine: 'underline' }}>
            Powered by Tarkov.dev API
          </Text>
        </Link>
      </XStack>
      <Text fontSize="$1" color="$color9" textAlign="center" maxWidth={600}>
        This project is free software licensed under GNU GPLv3. 
        Data sourced from Tarkov.dev API, also licensed under GNU GPLv3.
      </Text>
    </YStack>
  )
}
