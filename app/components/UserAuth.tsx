'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Text, XStack, YStack } from 'tamagui'
import { LogOut } from 'lucide-react'

export function UserAuth() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const storedUsername = localStorage.getItem('username')
    setUsername(storedUsername)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('playerLevel')
    localStorage.removeItem('tarkov-quest-done')
    router.push('/login')
    router.refresh()
  }

  if (!username) {
    return (
      <Button
        size="$2"
        theme="blue"
        onPress={() => router.push('/login')}
      >
        <Text fontSize="$2">Login</Text>
      </Button>
    )
  }

  return (
    <XStack gap="$2" alignItems="center">
      <Text fontSize="$2" color="$color10">
        {username}
      </Text>
      <Button
        size="$2"
        theme="gray"
        onPress={handleLogout}
      >
        <LogOut size={14} />
      </Button>
    </XStack>
  )
}

