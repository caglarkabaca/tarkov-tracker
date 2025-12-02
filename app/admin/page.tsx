'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, H1, Text, XStack, YStack, Spinner, ScrollView, Input } from 'tamagui'
import { ArrowLeft, Shield, Users, TrendingUp, CheckCircle2, Clock, Database, RefreshCw, AlertCircle, Globe } from 'lucide-react'
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
  const [wikiScraping, setWikiScraping] = useState(false)
  const [wikiStatus, setWikiStatus] = useState<{
    total: number
    lastScraped: string | null
    needsUpdate: number
  } | null>(null)
  const [loadingWikiStatus, setLoadingWikiStatus] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<Array<{
    timestamp: Date
    level: 'info' | 'success' | 'warning' | 'error'
    message: string
    questName?: string
    questId?: string
    details?: Record<string, unknown>
  }>>([])
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [testWikiUrl, setTestWikiUrl] = useState('')
  const [testingWiki, setTestingWiki] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loadingQuestList, setLoadingQuestList] = useState(false)
  const [questListResult, setQuestListResult] = useState<Array<{ name: string; wikiUrl: string; trader?: string }> | null>(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/login')
      return
    }

    fetchUsers(userId)
    fetchDataStatus(userId)
    fetchWikiStatus(userId)
    
    // Cleanup polling interval on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
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

  const fetchWikiStatus = async (userId: string) => {
    setLoadingWikiStatus(true)
    try {
      const response = await fetch('/api/admin/wiki/status', {
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setWikiStatus({
          total: data.total || 0,
          lastScraped: data.lastScraped || null,
          needsUpdate: data.needsUpdate || 0,
        })
      }
    } catch (err) {
      console.error('Error fetching wiki status:', err)
    } finally {
      setLoadingWikiStatus(false)
    }
  }

  const scrapeWiki = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    if (!confirm('This will scrape wiki data for all quests. This may take a long time. Continue?')) {
      return
    }

    setWikiScraping(true)
    setError(null)
    setLogEntries([])

    try {
      const response = await fetch('/api/admin/wiki/scrape', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to scrape wiki')
        return
      }

      // Start polling for logs
      if (data.jobId) {
        setCurrentJobId(data.jobId)
        startLogPolling(data.jobId, userId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error scraping wiki:', err)
      setWikiScraping(false)
    }
  }

  const startLogPolling = (jobId: string, userId: string) => {
    // Clear existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // Poll immediately
    fetchLogs(jobId, userId)

    // Set up polling every 2 seconds
    const interval = setInterval(() => {
      fetchLogs(jobId, userId)
    }, 2000)

    setPollingInterval(interval)
  }

  const fetchLogs = async (jobId: string, userId: string) => {
    try {
      const response = await fetch(`/api/admin/wiki/logs/${jobId}`, {
        headers: {
          'x-user-id': userId,
        },
      })

      if (!response.ok) return

      const data = await response.json()

      if (data.success && data.job) {
        // Convert timestamp strings to Date objects
        const logs = (data.job.logs || []).map((log: any) => ({
          ...log,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        }))
        setLogEntries(logs)

        // Stop polling if job is completed or failed
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
          }
          setWikiScraping(false)
          setCurrentJobId(null)
          
          // Refresh wiki status
          await fetchWikiStatus(userId)
          
          if (data.job.status === 'completed') {
            alert(`Scraping completed: ${data.job.successfulQuests || 0}/${data.job.totalQuests || 0} quests scraped successfully!`)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
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

        {/* Wiki Scraping */}
        <Card elevate size="$4" bordered padding="$3" backgroundColor="$background">
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <XStack gap="$2" alignItems="center">
                <Globe size={20} color="var(--color-blue-10)" />
                <Text fontSize="$4" fontWeight="600" color="$color12">
                  Wiki Data Scraping
                </Text>
              </XStack>
              <Button
                size="$2"
                theme="blue"
                onPress={() => fetchWikiStatus(localStorage.getItem('userId') || '')}
                disabled={loadingWikiStatus}
              >
                {loadingWikiStatus ? (
                  <Spinner size="small" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
            </XStack>

            {loadingWikiStatus ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Spinner size="small" />
                <Text fontSize="$2" color="$color10" marginTop="$2">
                  Loading wiki status...
                </Text>
              </Card>
            ) : (
              <YStack gap="$2">
                {wikiStatus && (
                  <XStack gap="$4" flexWrap="wrap">
                    <YStack>
                      <Text fontSize="$1" color="$color10">Total Scraped</Text>
                      <Text fontSize="$4" fontWeight="bold" color="$blue10">
                        {wikiStatus.total}
                      </Text>
                    </YStack>
                    {wikiStatus.lastScraped && (
                      <YStack>
                        <Text fontSize="$1" color="$color10">Last Scraped</Text>
                        <Text fontSize="$2" color="$color12">
                          {formatDate(wikiStatus.lastScraped)}
                        </Text>
                      </YStack>
                    )}
                    {wikiStatus.needsUpdate > 0 && (
                      <YStack>
                        <Text fontSize="$1" color="$color10">Needs Update</Text>
                        <Text fontSize="$4" fontWeight="bold" color="$red10">
                          {wikiStatus.needsUpdate}
                        </Text>
                      </YStack>
                    )}
                  </XStack>
                )}

                <Button
                  size="$3"
                  theme="orange"
                  onPress={scrapeWiki}
                  disabled={wikiScraping}
                >
                  {wikiScraping ? (
                    <XStack gap="$2" alignItems="center">
                      <Spinner size="small" />
                      <Text fontSize="$2">Scraping Wiki...</Text>
                    </XStack>
                  ) : (
                    <XStack gap="$2" alignItems="center">
                      <Globe size={16} />
                      <Text fontSize="$2">Scrape Quest Data from Wiki</Text>
                    </XStack>
                  )}
                </Button>

                <Text fontSize="$1" color="$color9">
                  This will scrape all quest pages from the Escape from Tarkov wiki to extract prerequisites, 
                  level requirements, and quest relationships. This process may take a long time.
                </Text>

                {/* Test Single Wiki URL */}
                <Card size="$2" bordered padding="$3" backgroundColor="$gray2">
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$color12">
                      Test Wiki Scraping
                    </Text>
                    <Text fontSize="$1" color="$color10">
                      Enter a wiki URL to test scraping a single quest page:
                    </Text>
                    <XStack gap="$2" alignItems="center">
                      <Input
                        flex={1}
                        placeholder="https://escapefromtarkov.fandom.com/wiki/..."
                        value={testWikiUrl}
                        onChangeText={setTestWikiUrl}
                        borderColor="$borderColor"
                        backgroundColor="$background"
                        color="$color12"
                        fontSize="$2"
                      />
                      <Button
                        size="$3"
                        theme="blue"
                        onPress={async () => {
                          if (!testWikiUrl) return
                          setTestingWiki(true)
                          setTestResult(null)
                          
                          try {
                            const userId = localStorage.getItem('userId')
                            if (!userId) {
                              setTestResult('Error: Not authenticated')
                              setTestingWiki(false)
                              return
                            }
                            
                            const response = await fetch('/api/admin/wiki/test', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': userId,
                              },
                              body: JSON.stringify({ wikiUrl: testWikiUrl }),
                            })
                            
                            const data = await response.json()
                            if (data.success) {
                              setTestResult(JSON.stringify(data.result, null, 2))
                            } else {
                              setTestResult(`Error: ${data.error || 'Unknown error'}`)
                            }
                          } catch (error) {
                            setTestResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
                          } finally {
                            setTestingWiki(false)
                          }
                        }}
                        disabled={testingWiki || !testWikiUrl}
                      >
                        {testingWiki ? (
                          <Spinner size="small" />
                        ) : (
                          <Text>Test</Text>
                        )}
                      </Button>
                    </XStack>
                    
                    {testResult && (
                      <Card size="$2" bordered padding="$3" backgroundColor="#1a1a1a">
                        <ScrollView maxHeight={300}>
                          <Text fontSize="$1" color="#00ff00" fontFamily="monospace" whiteSpace="pre-wrap">
                            {testResult}
                          </Text>
                        </ScrollView>
                      </Card>
                    )}
                  </YStack>
                </Card>

                {/* Extract Quest List from Wiki */}
                <Card size="$2" bordered padding="$3" backgroundColor="$gray2">
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$color12">
                      Extract Quest List from Wiki
                    </Text>
                    <Text fontSize="$1" color="$color10">
                      Extract all quest links from the quest list page:
                    </Text>
                    <Button
                      size="$3"
                      theme="green"
                      onPress={async () => {
                        setLoadingQuestList(true)
                        setQuestListResult(null)
                        
                        try {
                          const userId = localStorage.getItem('userId')
                          if (!userId) {
                            setQuestListResult(null)
                            alert('Error: Not authenticated')
                            setLoadingQuestList(false)
                            return
                          }
                          
                          const response = await fetch('/api/admin/wiki/list', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-user-id': userId,
                            },
                            body: JSON.stringify({ 
                              wikiUrl: 'https://escapefromtarkov.fandom.com/wiki/Quests' 
                            }),
                          })
                          
                          const data = await response.json()
                          if (data.success) {
                            setQuestListResult(data.quests)
                          } else {
                            alert(`Error: ${data.error || 'Unknown error'}`)
                          }
                        } catch (error) {
                          alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
                        } finally {
                          setLoadingQuestList(false)
                        }
                      }}
                      disabled={loadingQuestList}
                    >
                      {loadingQuestList ? (
                        <XStack gap="$2" alignItems="center">
                          <Spinner size="small" />
                          <Text>Extracting...</Text>
                        </XStack>
                      ) : (
                        <XStack gap="$2" alignItems="center">
                          <Globe size={16} />
                          <Text>Extract Quest List</Text>
                        </XStack>
                      )}
                    </Button>
                    
                    {questListResult && (
                      <Card size="$2" bordered padding="$3" backgroundColor="#1a1a1a">
                        <YStack gap="$2">
                          <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                            Found {questListResult.length} quests
                          </Text>
                          <ScrollView maxHeight={400}>
                            <YStack gap="$1">
                              {questListResult.map((quest, index) => (
                                <XStack key={index} gap="$2" padding="$1" borderBottomWidth={1} borderBottomColor="#333">
                                  <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={80}>
                                    {index + 1}
                                  </Text>
                                  <YStack flex={1} gap="$0.5">
                                    <Text fontSize="$1" color="#00ff00" fontFamily="monospace">
                                      {quest.name}
                                    </Text>
                                    {quest.trader && (
                                      <Text fontSize="$1" color="#8888ff" fontFamily="monospace">
                                        Trader: {quest.trader}
                                      </Text>
                                    )}
                                    <Text fontSize="$1" color="#666" fontFamily="monospace" style={{ wordBreak: 'break-all' }}>
                                      {quest.wikiUrl}
                                    </Text>
                                  </YStack>
                                </XStack>
                              ))}
                            </YStack>
                          </ScrollView>
                        </YStack>
                      </Card>
                    )}
                  </YStack>
                </Card>

                {/* Terminal-style Log Viewer */}
                {currentJobId && logEntries.length > 0 && (
                  <Card size="$2" bordered padding="$2" backgroundColor="#1a1a1a" maxHeight={400}>
                    <YStack gap="$1">
                      <XStack gap="$2" alignItems="center" paddingBottom="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
                        <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                          Terminal Log
                        </Text>
                        <Text fontSize="$1" color="#888" fontFamily="monospace">
                          Job: {currentJobId.substring(0, 8)}...
                        </Text>
                      </XStack>
                      <ScrollView maxHeight={350}>
                        <YStack gap="$1" padding="$2">
                          {logEntries.map((log, index) => {
                            const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', {
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                            
                            let color = '#ffffff'
                            if (log.level === 'success') color = '#00ff00'
                            else if (log.level === 'warning') color = '#ffaa00'
                            else if (log.level === 'error') color = '#ff4444'
                            else if (log.level === 'info') color = '#8888ff'
                            
                            const details = log.details as any
                            
                            return (
                              <YStack key={index} gap="$1" paddingBottom="$2" borderBottomWidth={1} borderBottomColor="#333">
                                <XStack gap="$2" alignItems="flex-start">
                                  <Text fontSize="$1" color="#666" fontFamily="monospace" minWidth={80}>
                                    [{timeStr}]
                                  </Text>
                                  <YStack flex={1} gap="$1">
                                    {/* Render git diff style message */}
                                    {log.message.includes('--- API Data') ? (
                                      <YStack gap="$0.5" padding="$2" backgroundColor="#1a1a1a" borderRadius="$2" borderWidth={1} borderColor="#333">
                                        {log.message.split('\n').map((line: string, lineIndex: number) => {
                                          let lineColor = '#ffffff'
                                          let prefix = ''
                                          
                                          if (line.startsWith('--- ')) {
                                            lineColor = '#ff4444' // Red for API header
                                            prefix = ''
                                          } else if (line.startsWith('+++ ')) {
                                            lineColor = '#44ff44' // Green for Wiki header
                                            prefix = ''
                                          } else if (line.startsWith('- ')) {
                                            lineColor = '#ff6666' // Light red for removed
                                            prefix = '- '
                                          } else if (line.startsWith('+ ')) {
                                            lineColor = '#66ff66' // Light green for added
                                            prefix = '+ '
                                          } else if (line.trim().startsWith('•')) {
                                            lineColor = '#ffaa00' // Orange for changes
                                            prefix = ''
                                          } else if (line.trim()) {
                                            lineColor = '#cccccc' // Gray for context
                                            prefix = '  '
                                          }
                                          
                                          if (!line.trim() && lineIndex > 0) {
                                            return null // Skip empty lines
                                          }
                                          
                                          return (
                                            <Text 
                                              key={lineIndex} 
                                              fontSize="$1" 
                                              color={lineColor} 
                                              fontFamily="monospace"
                                              whiteSpace="pre"
                                              lineHeight="$1"
                                            >
                                              {prefix}{line.trim() || '\u00A0'}
                                            </Text>
                                          )
                                        })}
                                      </YStack>
                                    ) : (
                                      <Text fontSize="$1" color={color} fontFamily="monospace" whiteSpace="pre-wrap">
                                        {log.message}
                                      </Text>
                                    )}
                                    
                                    {/* Show additional details if available */}
                                    {details && details.diffLines && Array.isArray(details.diffLines) && details.diffLines.length > 0 && !log.message.includes('--- API Data') && (
                                      <YStack gap="$0.5" padding="$2" backgroundColor="#1a1a1a" borderRadius="$2" borderWidth={1} borderColor="#333">
                                        <Text fontSize="$1" color="#ff4444" fontFamily="monospace">
                                          --- API Data
                                        </Text>
                                        <Text fontSize="$1" color="#44ff44" fontFamily="monospace">
                                          +++ Wiki Data
                                        </Text>
                                        {details.diffLines.map((line: string, lineIndex: number) => {
                                          let lineColor = '#ffffff'
                                          if (line.startsWith('- ')) {
                                            lineColor = '#ff6666'
                                          } else if (line.startsWith('+ ')) {
                                            lineColor = '#66ff66'
                                          } else {
                                            lineColor = '#cccccc'
                                          }
                                          return (
                                            <Text key={lineIndex} fontSize="$1" color={lineColor} fontFamily="monospace">
                                              {line}
                                            </Text>
                                          )
                                        })}
                                      </YStack>
                                    )}
                                  </YStack>
                                </XStack>
                              </YStack>
                            )
                          })}
                        </YStack>
                      </ScrollView>
                    </YStack>
                  </Card>
                )}
              </YStack>
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

