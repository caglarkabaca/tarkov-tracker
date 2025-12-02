'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, H1, Text, XStack, YStack, Spinner, ScrollView } from 'tamagui'
import { ArrowLeft, Shield, Users, TrendingUp, CheckCircle2, Clock, Database, RefreshCw, AlertCircle } from 'lucide-react'
import { Footer } from '../components/Footer'

interface User {
  id: string
  username: string
  playerLevel: number
  completedQuestCount: number
  completedQuestIds: string[]
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface UsersResponse {
  success: boolean
  users?: User[]
  count?: number
  error?: string
}

interface DataStatus {
  queryName: string
  lastFetched: string | null
  hoursSinceLastFetch: number | null
  shouldFetch: boolean
  cacheValid: boolean
  dataCount: number
  dataType: string
}

interface DataStatusResponse {
  success: boolean
  dataStatuses?: DataStatus[]
  error?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataStatuses, setDataStatuses] = useState<DataStatus[]>([])
  const [loadingDataStatus, setLoadingDataStatus] = useState(false)
  const [fetchingStatus, setFetchingStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/login')
      return
    }

    fetchUsers(userId)
    fetchDataStatus(userId)
  }, [router])

  const fetchUsers = async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'x-user-id': userId,
        },
      })

      const data: UsersResponse = await response.json()

      if (!response.ok || !data.success) {
        if (response.status === 403) {
          setError('You do not have admin access')
          setTimeout(() => router.push('/'), 2000)
        } else {
          setError(data.error || 'Failed to fetch users')
        }
        return
      }

      if (data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleAdminStatus = async (targetUserId: string, currentStatus: boolean) => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${targetUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ isAdmin: !currentStatus }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to update admin status')
        return
      }

      // Refresh users list
      await fetchUsers(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error updating admin status:', err)
    }
  }

  const fetchDataStatus = async (userId: string) => {
    setLoadingDataStatus(true)
    try {
      const response = await fetch('/api/admin/data-status', {
        headers: {
          'x-user-id': userId,
        },
      })

      const data: DataStatusResponse = await response.json()

      if (response.ok && data.success && data.dataStatuses) {
        setDataStatuses(data.dataStatuses)
      }
    } catch (err) {
      console.error('Error fetching data status:', err)
    } finally {
      setLoadingDataStatus(false)
    }
  }

  const forceFetchData = async (queryName: string) => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    setFetchingStatus(prev => ({ ...prev, [queryName]: true }))
    setError(null)

    try {
      let url: string
      if (queryName === 'quests') {
        url = `/api/tarkov/fetch?queryName=quests&force=true`
      } else if (queryName === 'traders') {
        url = `/api/tarkov/traders?force=true`
      } else {
        setError('Unknown data type')
        return
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to fetch data')
        return
      }

      // Refresh data status after successful fetch
      await fetchDataStatus(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error force fetching data:', err)
    } finally {
      setFetchingStatus(prev => ({ ...prev, [queryName]: false }))
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'N/A'
    }
  }

  const totalUsers = users.length
  const totalAdmins = users.filter(u => u.isAdmin).length
  const totalCompletedQuests = users.reduce((sum, u) => sum + u.completedQuestCount, 0)
  const avgLevel = users.length > 0 
    ? Math.round(users.reduce((sum, u) => sum + (u.playerLevel || 1), 0) / users.length) 
    : 0

  if (loading) {
    return (
      <YStack fullscreen backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2">Loading users...</Text>
      </YStack>
    )
  }

  if (error) {
    return (
      <YStack fullscreen backgroundColor="$background" padding="$4" alignItems="center" justifyContent="center">
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$red2" maxWidth={500}>
          <YStack gap="$2" alignItems="center">
            <Text fontSize="$4" color="$red10" fontWeight="600">
              Error
            </Text>
            <Text fontSize="$2" color="$red10" textAlign="center">
              {error}
            </Text>
            <Button marginTop="$2" onPress={() => router.push('/')}>
              Go Home
            </Button>
          </YStack>
        </Card>
      </YStack>
    )
  }

  return (
    <YStack fullscreen backgroundColor="$background" padding="$2" gap="$2">
      <YStack gap="$2" maxWidth={1800} width="100%" marginHorizontal="auto">
        {/* Header */}
        <XStack gap="$2" alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <XStack gap="$2" alignItems="center">
            <Button
              size="$2"
              theme="gray"
              onPress={() => router.push('/')}
            >
              <ArrowLeft size={16} />
            </Button>
            <Shield size={24} color="var(--color-yellow-10)" />
            <YStack gap="$0">
              <H1 size="$7" color="$color12">
                Admin Panel
              </H1>
              <Text fontSize="$1" color="$color9">
                User Management
              </Text>
            </YStack>
          </XStack>
          
          <Button
            size="$2"
            theme="blue"
            onPress={() => {
              const userId = localStorage.getItem('userId') || ''
              fetchUsers(userId)
              fetchDataStatus(userId)
            }}
          >
            <Text fontSize="$1">Refresh All</Text>
          </Button>
        </XStack>

        {/* Statistics Cards */}
        <XStack gap="$2" flexWrap="wrap">
          <Card elevate size="$3" bordered padding="$3" backgroundColor="$background" flex={1} minWidth={200}>
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <Users size={20} color="var(--color-blue-10)" />
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Total Users
                </Text>
              </XStack>
              <Text fontSize="$6" fontWeight="bold" color="$blue10">
                {totalUsers}
              </Text>
            </YStack>
          </Card>

          <Card elevate size="$3" bordered padding="$3" backgroundColor="$background" flex={1} minWidth={200}>
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <Shield size={20} color="var(--color-yellow-10)" />
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Admins
                </Text>
              </XStack>
              <Text fontSize="$6" fontWeight="bold" color="$yellow10">
                {totalAdmins}
              </Text>
            </YStack>
          </Card>

          <Card elevate size="$3" bordered padding="$3" backgroundColor="$background" flex={1} minWidth={200}>
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <TrendingUp size={20} color="var(--color-green-10)" />
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Avg Level
                </Text>
              </XStack>
              <Text fontSize="$6" fontWeight="bold" color="$green10">
                {avgLevel}
              </Text>
            </YStack>
          </Card>

          <Card elevate size="$3" bordered padding="$3" backgroundColor="$background" flex={1} minWidth={200}>
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <CheckCircle2 size={20} color="var(--color-purple-10)" />
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Total Completed
                </Text>
              </XStack>
              <Text fontSize="$6" fontWeight="bold" color="$purple10">
                {totalCompletedQuests}
              </Text>
            </YStack>
          </Card>
        </XStack>

        {/* Data Status */}
        <Card elevate size="$4" bordered padding="$3" backgroundColor="$background">
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <XStack gap="$2" alignItems="center">
                <Database size={20} color="var(--color-blue-10)" />
                <Text fontSize="$4" fontWeight="600" color="$color12">
                  Data Status
                </Text>
              </XStack>
              <Button
                size="$2"
                theme="blue"
                onPress={() => fetchDataStatus(localStorage.getItem('userId') || '')}
                disabled={loadingDataStatus}
              >
                {loadingDataStatus ? (
                  <Spinner size="small" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
            </XStack>

            {loadingDataStatus ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Spinner size="small" />
                <Text fontSize="$2" color="$color10" marginTop="$2">
                  Loading data status...
                </Text>
              </Card>
            ) : dataStatuses.length === 0 ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Text fontSize="$2" color="$color10">
                  No data status available.
                </Text>
              </Card>
            ) : (
              <XStack gap="$2" flexWrap="wrap">
                {dataStatuses.map((status) => (
                  <Card
                    key={status.queryName}
                    size="$3"
                    bordered
                    padding="$3"
                    backgroundColor={status.cacheValid ? "$green2" : "$red2"}
                    borderColor={status.cacheValid ? "$green8" : "$red8"}
                    flex={1}
                    minWidth={300}
                  >
                    <YStack gap="$2">
                      <XStack gap="$2" alignItems="center" justifyContent="space-between">
                        <Text fontSize="$3" fontWeight="600" color="$color12">
                          {status.dataType}
                        </Text>
                        <XStack gap="$2" alignItems="center">
                          {status.cacheValid ? (
                            <XStack
                              gap="$1"
                              alignItems="center"
                              paddingHorizontal="$2"
                              paddingVertical="$1"
                              backgroundColor="$green4"
                              borderRadius="$2"
                            >
                              <CheckCircle2 size={12} color="var(--color-green-10)" />
                              <Text fontSize="$1" color="$green10" fontWeight="600">
                                Valid
                              </Text>
                            </XStack>
                          ) : (
                            <XStack
                              gap="$1"
                              alignItems="center"
                              paddingHorizontal="$2"
                              paddingVertical="$1"
                              backgroundColor="$red4"
                              borderRadius="$2"
                            >
                              <AlertCircle size={12} color="var(--color-red-10)" />
                              <Text fontSize="$1" color="$red10" fontWeight="600">
                                Expired
                              </Text>
                            </XStack>
                          )}
                          <Button
                            size="$1"
                            theme="orange"
                            onPress={() => forceFetchData(status.queryName)}
                            disabled={fetchingStatus[status.queryName]}
                          >
                            {fetchingStatus[status.queryName] ? (
                              <Spinner size="small" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                          </Button>
                        </XStack>
                      </XStack>

                      <YStack gap="$1" marginTop="$2">
                        <XStack gap="$2" alignItems="center">
                          <Database size={14} color="var(--color-9)" />
                          <Text fontSize="$2" color="$color10">
                            Count: <Text fontWeight="600" color="$color12">{status.dataCount}</Text>
                          </Text>
                        </XStack>

                        {status.lastFetched ? (
                          <>
                            <XStack gap="$2" alignItems="center">
                              <Clock size={14} color="var(--color-9)" />
                              <Text fontSize="$2" color="$color10">
                                Last Updated: <Text fontWeight="600" color="$color12">
                                  {formatDate(status.lastFetched)}
                                </Text>
                              </Text>
                            </XStack>
                            {status.hoursSinceLastFetch !== null && (
                              <Text fontSize="$1" color="$color9">
                                {status.hoursSinceLastFetch < 1
                                  ? `${Math.round(status.hoursSinceLastFetch * 60)} minutes ago`
                                  : status.hoursSinceLastFetch < 24
                                  ? `${Math.round(status.hoursSinceLastFetch)} hours ago`
                                  : `${Math.round(status.hoursSinceLastFetch / 24)} days ago`}
                              </Text>
                            )}
                          </>
                        ) : (
                          <XStack gap="$2" alignItems="center">
                            <AlertCircle size={14} color="var(--color-9)" />
                            <Text fontSize="$2" color="$color10">
                              Never updated
                            </Text>
                          </XStack>
                        )}
                      </YStack>
                    </YStack>
                  </Card>
                ))}
              </XStack>
            )}
          </YStack>
        </Card>

        {/* Users List */}
        <Card elevate size="$4" bordered padding="$3" backgroundColor="$background">
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color12">
              All Users ({totalUsers})
            </Text>
            
            {users.length === 0 ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Text fontSize="$2" color="$color10">
                  No users found.
                </Text>
              </Card>
            ) : (
              <ScrollView maxHeight="calc(100vh - 400px)">
                <YStack gap="$2">
                  {users.map((user) => (
                    <Card
                      key={user.id}
                      size="$3"
                      bordered
                      padding="$3"
                      backgroundColor={user.isAdmin ? "$yellow2" : "$background"}
                      borderColor={user.isAdmin ? "$yellow8" : "$borderColor"}
                    >
                      <XStack gap="$3" alignItems="center" flexWrap="wrap">
                        <YStack flex={1} minWidth={200}>
                          <XStack gap="$2" alignItems="center">
                            <Text fontSize="$3" fontWeight="600" color="$color12">
                              {user.username}
                            </Text>
                            {user.isAdmin && (
                              <XStack
                                gap="$1"
                                alignItems="center"
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                backgroundColor="$yellow4"
                                borderRadius="$2"
                              >
                                <Shield size={12} color="var(--color-yellow-10)" />
                                <Text fontSize="$1" color="$yellow10" fontWeight="600">
                                  Admin
                                </Text>
                              </XStack>
                            )}
                          </XStack>
                          <Text fontSize="$1" color="$color9" marginTop="$1">
                            Created: {formatDate(user.createdAt)}
                          </Text>
                        </YStack>

                        <XStack gap="$4" alignItems="center" flexWrap="wrap">
                          <YStack alignItems="flex-end">
                            <Text fontSize="$1" color="$color10">
                              Level
                            </Text>
                            <Text fontSize="$4" fontWeight="bold" color="$blue10">
                              {user.playerLevel || 1}
                            </Text>
                          </YStack>

                          <YStack alignItems="flex-end">
                            <Text fontSize="$1" color="$color10">
                              Completed
                            </Text>
                            <Text fontSize="$4" fontWeight="bold" color="$green10">
                              {user.completedQuestCount}
                            </Text>
                          </YStack>

                          <YStack alignItems="flex-end">
                            <Text fontSize="$1" color="$color10">
                              Last Updated
                            </Text>
                            <XStack gap="$1" alignItems="center">
                              <Clock size={12} color="var(--color-9)" />
                              <Text fontSize="$1" color="$color9">
                                {formatDate(user.updatedAt)}
                              </Text>
                            </XStack>
                          </YStack>
                        </XStack>

                        <Button
                          size="$2"
                          theme={user.isAdmin ? "red" : "yellow"}
                          onPress={() => toggleAdminStatus(user.id, user.isAdmin)}
                        >
                          <XStack gap="$1" alignItems="center">
                            <Shield size={14} />
                            <Text fontSize="$1">
                              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                            </Text>
                          </XStack>
                        </Button>
                      </XStack>
                    </Card>
                  ))}
                </YStack>
              </ScrollView>
            )}
          </YStack>
        </Card>
      </YStack>
      <Footer />
    </YStack>
  )
}

