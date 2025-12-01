'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, H1, Text, XStack, YStack, Input, Spinner } from 'tamagui'

interface AuthResponse {
  success: boolean
  user?: {
    id: string
    username: string
    playerLevel?: number
  }
  error?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data: AuthResponse = await response.json()

      if (data.success && data.user) {
        // Save user info to localStorage
        localStorage.setItem('userId', data.user.id)
        localStorage.setItem('username', data.user.username)
        if (data.user.playerLevel) {
          localStorage.setItem('playerLevel', data.user.playerLevel.toString())
        }
        
        // Redirect to home page
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || 'Authentication failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <YStack
      fullscreen
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      padding="$4"
    >
      <Card
        elevate
        size="$4"
        bordered
        padding="$4"
        backgroundColor="$background"
        width="100%"
        maxWidth={400}
      >
        <YStack gap="$4">
          <H1 size="$8" textAlign="center" color="$color12">
            {isLogin ? 'Login' : 'Register'}
          </H1>

          {error && (
            <Card size="$2" bordered padding="$2" backgroundColor="$red2">
              <Text fontSize="$2" color="$red10">{error}</Text>
            </Card>
          )}

          <form onSubmit={handleSubmit}>
            <YStack gap="$3">
              <YStack gap="$2">
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Username
                </Text>
                <Input
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  backgroundColor="$gray2"
                  borderColor="$gray6"
                  fontSize="$3"
                  autoComplete="username"
                />
              </YStack>

              <YStack gap="$2">
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Password
                </Text>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry
                  backgroundColor="$gray2"
                  borderColor="$gray6"
                  fontSize="$3"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </YStack>

              <Button
                size="$4"
                theme="blue"
                onPress={handleSubmit}
                disabled={loading || !username || !password}
                marginTop="$2"
              >
                {loading ? (
                  <Spinner size="small" />
                ) : (
                  <Text fontSize="$4" fontWeight="600">
                    {isLogin ? 'Login' : 'Register'}
                  </Text>
                )}
              </Button>
            </YStack>
          </form>

          <XStack gap="$2" justifyContent="center" alignItems="center">
            <Text fontSize="$2" color="$color10">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Button
              size="$2"
              chromeless
              onPress={() => {
                setIsLogin(!isLogin)
                setError(null)
              }}
            >
              <Text fontSize="$2" color="$blue10" fontWeight="600">
                {isLogin ? 'Register' : 'Login'}
              </Text>
            </Button>
          </XStack>
        </YStack>
      </Card>
    </YStack>
  )
}

