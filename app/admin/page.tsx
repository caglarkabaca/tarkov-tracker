'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, H1, Text, XStack, YStack, Spinner, ScrollView, Input, Dialog, Sheet } from 'tamagui'
import { ArrowLeft, Shield, Users, TrendingUp, CheckCircle2, Clock, Database, RefreshCw, AlertCircle, Globe, Download, Edit, Search, X } from 'lucide-react'
import { Footer } from '../components/Footer'
import type { Task } from '@/lib/utils/questTree'

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
  const [missingScraping, setMissingScraping] = useState(false)
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
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null)
  const [testWikiUrl, setTestWikiUrl] = useState('')
  const [testingWiki, setTestingWiki] = useState(false)
  const [testResult, setTestResult] = useState<any | null>(null)
  const [showTestResultRaw, setShowTestResultRaw] = useState(false)
  const [loadingQuestList, setLoadingQuestList] = useState(false)
  const [questListResult, setQuestListResult] = useState<Array<{ name: string; wikiUrl: string; trader?: string }> | null>(null)
  const logScrollViewRef = useRef<any>(null)
  const [questStatus, setQuestStatus] = useState<{
    lastFetched: Date | null
    hoursSinceLastFetch: number | null
    totalCount: number | null
    progress?: {
      jobId?: string
      currentIndex?: number
      totalQuests?: number
      lastScrapedQuest?: string
      updatedAt?: Date
    }
    cacheExists: boolean
    tasksCount: number
  } | null>(null)
  const [loadingQuestStatus, setLoadingQuestStatus] = useState(false)
  const [downloadingImages, setDownloadingImages] = useState(false)
  const [fetchingRawWiki, setFetchingRawWiki] = useState(false)
  const [rawWikiStatus, setRawWikiStatus] = useState<{
    total: number
    oldestFetched?: Date
    newestFetched?: Date
    lastScraped?: Date
  } | null>(null)
  const [loadingRawWikiStatus, setLoadingRawWikiStatus] = useState(false)
  const [allQuests, setAllQuests] = useState<Task[]>([])
  const [loadingQuests, setLoadingQuests] = useState(false)
  const [questSearchQuery, setQuestSearchQuery] = useState('')
  const [editingQuest, setEditingQuest] = useState<Task | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [savingQuest, setSavingQuest] = useState(false)

  // Auto-scroll log viewer to bottom when new logs arrive
  useEffect(() => {
    if (logScrollViewRef.current && logEntries.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        try {
          // Try multiple methods to scroll to bottom
          const scrollElement = logScrollViewRef.current
          
          // Method 1: Try native scroll ref
          const nativeRef = scrollElement?.getNativeScrollRef?.()
          if (nativeRef) {
            nativeRef.scrollTop = nativeRef.scrollHeight
            return
          }
          
          // Method 2: Try scrollRef
          const scrollRef = scrollElement?.scrollRef?.current
          if (scrollRef) {
            scrollRef.scrollTop = scrollRef.scrollHeight
            return
          }
          
          // Method 3: Find the scrollable container in DOM
          const scrollContainer = document.querySelector('[data-log-scroll-container]')
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight
            return
          }
          
          // Method 4: Use scrollIntoView on last log entry
          const lastLogIndex = logEntries.length - 1
          const lastLogElement = document.querySelector(`[data-log-index="${lastLogIndex}"]`)
          if (lastLogElement) {
            lastLogElement.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }
        } catch (err) {
          // Ignore scroll errors
          console.log('Auto-scroll error (non-critical):', err)
        }
      }, 150)
    }
  }, [logEntries])

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/login')
      return
    }

    fetchUsers(userId)
    fetchDataStatus(userId)
    fetchWikiStatus(userId)
    fetchQuestStatus(userId)
    fetchRawWikiStatus(userId)
    fetchQuests(userId)
    
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
      // Only traders can be fetched from tarkov-api now
      if (queryName !== 'traders') {
        setError('Unknown data type')
        return
      }

      const url = `/api/tarkov/traders?force=true`

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

  const fetchQuestStatus = async (userId: string) => {
    setLoadingQuestStatus(true)
    try {
      const response = await fetch('/api/admin/quests/status', {
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (response.ok && data.success && data.status) {
        setQuestStatus({
          lastFetched: data.status.lastFetched ? new Date(data.status.lastFetched) : null,
          hoursSinceLastFetch: data.status.hoursSinceLastFetch || null,
          totalCount: data.status.totalCount || null,
          progress: data.status.progress ? {
            jobId: data.status.progress.jobId,
            currentIndex: data.status.progress.currentIndex,
            totalQuests: data.status.progress.totalQuests,
            lastScrapedQuest: data.status.progress.lastScrapedQuest,
            updatedAt: data.status.progress.updatedAt ? new Date(data.status.progress.updatedAt) : undefined,
          } : undefined,
          cacheExists: data.status.cacheExists || false,
          tasksCount: data.status.tasksCount || 0,
        })
      }
    } catch (err) {
      console.error('Error fetching quest status:', err)
    } finally {
      setLoadingQuestStatus(false)
    }
  }

  const scrapeWiki = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    if (!confirm('This will scrape all quests from wiki and save them to MongoDB. This may take a long time. Continue?')) {
      return
    }

    setWikiScraping(true)
    setError(null)
    setLogEntries([])

    try {
      const response = await fetch('/api/admin/wiki/scrape-full', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to scrape wiki')
        setWikiScraping(false)
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

  const scrapeMissingQuests = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    if (!confirm('This will scrape only missing quests from wiki that are not already in the database. Continue?')) {
      return
    }

    setMissingScraping(true)
    setError(null)
    setLogEntries([])

    try {
      const response = await fetch('/api/admin/wiki/scrape-missing', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to scrape missing quests')
        setMissingScraping(false)
        return
      }

      // Start polling for logs
      if (data.jobId) {
        setCurrentJobId(data.jobId)
        startLogPolling(data.jobId, userId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error scraping missing quests:', err)
      setMissingScraping(false)
    }
  }

  const downloadImages = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    if (!confirm('This will download all quest images from wiki_quests and save them as base64. This may take a long time. Continue?')) {
      return
    }

    setDownloadingImages(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/wiki/images/download', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to download images')
        setDownloadingImages(false)
        return
      }

      alert(`Image download completed: ${data.downloaded}/${data.total} images downloaded successfully!${data.failed > 0 ? ` (${data.failed} failed)` : ''}`)
      setDownloadingImages(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error downloading images:', err)
      setDownloadingImages(false)
    }
  }

  const fetchQuests = async (userId: string) => {
    setLoadingQuests(true)
    try {
      const response = await fetch('/api/wiki/quests', {
        headers: {
          'x-user-id': userId,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch quests')
      }

      const data = await response.json()
      if (data.success && data.data && data.data.tasks) {
        setAllQuests(data.data.tasks)
      } else if (data.success && data.tasks) {
        // Fallback for direct tasks property
        setAllQuests(data.tasks)
      } else {
        console.error('Unexpected response format:', data)
        setError('Unexpected response format from API')
      }
    } catch (err) {
      console.error('Error fetching quests:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch quests')
    } finally {
      setLoadingQuests(false)
    }
  }

  const handleEditQuest = async (quest: Task) => {
    setEditingQuest(JSON.parse(JSON.stringify(quest))) // Deep copy
    setEditModalOpen(true)
  }

  const handleSaveQuest = async () => {
    if (!editingQuest) return

    setSavingQuest(true)
    try {
      const userId = localStorage.getItem('userId')
      if (!userId) {
        alert('Error: Not authenticated')
        return
      }

      const response = await fetch(`/api/admin/quests/${editingQuest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ task: editingQuest }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Quest updated successfully!')
        setEditModalOpen(false)
        setEditingQuest(null)
        // Refresh quest list
        await fetchQuests(userId)
      } else {
        alert(`Error: ${data.error || 'Failed to update quest'}`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSavingQuest(false)
    }
  }

  const fetchRawWikiStatus = async (userId: string) => {
    setLoadingRawWikiStatus(true)
    try {
      const response = await fetch('/api/admin/wiki/raw/status', {
        headers: {
          'x-user-id': userId,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.status) {
          setRawWikiStatus(data.status)
        }
      }
    } catch (err) {
      console.error('Error fetching raw wiki status:', err)
    } finally {
      setLoadingRawWikiStatus(false)
    }
  }

  const fetchRawWikiQuests = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      setError('Not authenticated')
      return
    }

    if (!confirm('This will fetch all quest pages from the wiki and save raw HTML to raw_wiki_quests collection. This may take a long time. Continue?')) {
      return
    }

    setFetchingRawWiki(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/wiki/raw/fetch', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to fetch raw wiki quests')
        setFetchingRawWiki(false)
        return
      }

      alert(`Raw wiki fetch completed: ${data.fetched}/${data.total} pages fetched successfully!${data.failed > 0 ? ` (${data.failed} failed)` : ''}`)
      setFetchingRawWiki(false)
      
      // Refresh status
      await fetchRawWikiStatus(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error fetching raw wiki quests:', err)
      setFetchingRawWiki(false)
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

        // Update quest status while polling
        await fetchQuestStatus(userId)
        
        // Stop polling if job is completed or failed
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
          }
          setWikiScraping(false)
          setMissingScraping(false)
          setCurrentJobId(null)
          
          // Refresh wiki status and quest status
          await fetchWikiStatus(userId)
          await fetchQuestStatus(userId)
          
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
    <YStack fullscreen backgroundColor="$background" padding="$4" gap="$4">
      <YStack gap="$4" maxWidth={1800} width="100%" marginHorizontal="auto">
        {/* Header */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background">
          <XStack gap="$4" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <XStack gap="$3" alignItems="center">
              <Button
                size="$3"
                theme="gray"
                circular
                onPress={() => router.push('/')}
              >
                <ArrowLeft size={18} />
              </Button>
              <YStack gap="$1" paddingLeft="$2">
                <XStack gap="$2" alignItems="center">
                  <Shield size={28} color="var(--color-yellow-10)" />
                  <H1 size="$8" color="$color12" fontWeight="800">
                    Admin Panel
                  </H1>
                </XStack>
                <Text fontSize="$2" color="$color10" paddingLeft="$8">
                  System Management & Monitoring
                </Text>
              </YStack>
            </XStack>
            
            <Button
              size="$3"
              theme="blue"
              onPress={() => {
                const userId = localStorage.getItem('userId') || ''
                fetchUsers(userId)
                fetchDataStatus(userId)
                fetchWikiStatus(userId)
                fetchQuestStatus(userId)
              }}
            >
              <XStack gap="$2" alignItems="center">
                <RefreshCw size={16} />
                <Text fontSize="$2" fontWeight="600">Refresh All</Text>
              </XStack>
            </Button>
          </XStack>
        </Card>

        {/* Statistics Cards */}
        <XStack gap="$3" flexWrap="wrap">
          <Card 
            elevate 
            size="$4" 
            bordered 
            padding="$4" 
            backgroundColor="$blue2" 
            borderColor="$blue8"
            flex={1} 
            minWidth={220}
            hoverStyle={{ scale: 1.02 }}
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$blue4" borderRadius="$3">
                  <Users size={22} color="var(--color-blue-10)" />
                </Card>
                <Text fontSize="$3" fontWeight="700" color="$color12">
                  Total Users
                </Text>
              </XStack>
              <Text fontSize="$8" fontWeight="900" color="$blue10" paddingLeft="$2">
                {totalUsers}
              </Text>
            </YStack>
          </Card>

          <Card 
            elevate 
            size="$4" 
            bordered 
            padding="$4" 
            backgroundColor="$yellow2" 
            borderColor="$yellow8"
            flex={1} 
            minWidth={220}
            hoverStyle={{ scale: 1.02 }}
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$yellow4" borderRadius="$3">
                  <Shield size={22} color="var(--color-yellow-10)" />
                </Card>
                <Text fontSize="$3" fontWeight="700" color="$color12">
                  Admins
                </Text>
              </XStack>
              <Text fontSize="$8" fontWeight="900" color="$yellow10" paddingLeft="$2">
                {totalAdmins}
              </Text>
            </YStack>
          </Card>

          <Card 
            elevate 
            size="$4" 
            bordered 
            padding="$4" 
            backgroundColor="$green2" 
            borderColor="$green8"
            flex={1} 
            minWidth={220}
            hoverStyle={{ scale: 1.02 }}
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$green4" borderRadius="$3">
                  <TrendingUp size={22} color="var(--color-green-10)" />
                </Card>
                <Text fontSize="$3" fontWeight="700" color="$color12">
                  Avg Level
                </Text>
              </XStack>
              <Text fontSize="$8" fontWeight="900" color="$green10" paddingLeft="$2">
                {avgLevel}
              </Text>
            </YStack>
          </Card>

          <Card 
            elevate 
            size="$4" 
            bordered 
            padding="$4" 
            backgroundColor="$purple2" 
            borderColor="$purple8"
            flex={1} 
            minWidth={220}
            hoverStyle={{ scale: 1.02 }}
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$purple4" borderRadius="$3">
                  <CheckCircle2 size={22} color="var(--color-purple-10)" />
                </Card>
                <Text fontSize="$3" fontWeight="700" color="$color12">
                  Completed Quests
                </Text>
              </XStack>
              <Text fontSize="$8" fontWeight="900" color="$purple10" paddingLeft="$2">
                {totalCompletedQuests}
              </Text>
            </YStack>
          </Card>
        </XStack>

        {/* Traders Data Status */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background" borderColor="$blue8">
          <YStack gap="$3">
            <XStack gap="$3" alignItems="center" justifyContent="space-between">
              <XStack gap="$3" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$blue4" borderRadius="$3">
                  <Database size={24} color="var(--color-blue-10)" />
                </Card>
                <YStack gap="$1">
                  <Text fontSize="$5" fontWeight="800" color="$color12">
                    Traders Data
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    Tarkov-API trader information
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                theme="blue"
                onPress={() => fetchDataStatus(localStorage.getItem('userId') || '')}
                disabled={loadingDataStatus}
              >
                {loadingDataStatus ? (
                  <Spinner size="small" />
                ) : (
                  <XStack gap="$2" alignItems="center">
                    <RefreshCw size={16} />
                    <Text fontSize="$2">Refresh</Text>
                  </XStack>
                )}
              </Button>
            </XStack>

            {loadingDataStatus ? (
              <Card size="$3" bordered padding="$4" backgroundColor="$gray2" alignItems="center" borderRadius="$4">
                <Spinner size="large" />
                <Text fontSize="$3" color="$color10" marginTop="$3">
                  Loading traders data status...
                </Text>
              </Card>
            ) : dataStatuses.length === 0 ? (
              <Card size="$3" bordered padding="$4" backgroundColor="$gray2" alignItems="center" borderRadius="$4">
                <AlertCircle size={20} color="var(--color-gray-10)" />
                <Text fontSize="$3" color="$color10" marginTop="$2">
                  No traders data status available.
                </Text>
              </Card>
            ) : (
              <XStack gap="$3" flexWrap="wrap">
                {dataStatuses.map((status) => (
                  <Card
                    key={status.queryName}
                    size="$4"
                    bordered
                    padding="$4"
                    backgroundColor={status.cacheValid ? "$green2" : "$orange2"}
                    borderColor={status.cacheValid ? "$green8" : "$orange8"}
                    flex={1}
                    minWidth={350}
                    borderRadius="$4"
                    hoverStyle={{ scale: 1.02 }}
                  >
                    <YStack gap="$3">
                      <XStack gap="$3" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                        <YStack gap="$1">
                          <Text fontSize="$4" fontWeight="700" color="$color12">
                            {status.dataType}
                          </Text>
                          <XStack gap="$2" alignItems="center">
                            {status.cacheValid ? (
                              <XStack
                                gap="$1.5"
                                alignItems="center"
                                paddingHorizontal="$3"
                                paddingVertical="$1.5"
                                backgroundColor="$green4"
                                borderRadius="$3"
                              >
                                <CheckCircle2 size={14} color="var(--color-green-10)" />
                                <Text fontSize="$2" color="$green10" fontWeight="700">
                                  Valid
                                </Text>
                              </XStack>
                            ) : (
                              <XStack
                                gap="$1.5"
                                alignItems="center"
                                paddingHorizontal="$3"
                                paddingVertical="$1.5"
                                backgroundColor="$orange4"
                                borderRadius="$3"
                              >
                                <AlertCircle size={14} color="var(--color-orange-10)" />
                                <Text fontSize="$2" color="$orange10" fontWeight="700">
                                  Expired
                                </Text>
                              </XStack>
                            )}
                          </XStack>
                        </YStack>
                        <Button
                          size="$3"
                          theme={status.cacheValid ? "blue" : "orange"}
                          onPress={() => forceFetchData(status.queryName)}
                          disabled={fetchingStatus[status.queryName]}
                        >
                          {fetchingStatus[status.queryName] ? (
                            <XStack gap="$2" alignItems="center">
                              <Spinner size="small" />
                              <Text fontSize="$2">Fetching...</Text>
                            </XStack>
                          ) : (
                            <XStack gap="$2" alignItems="center">
                              <RefreshCw size={16} />
                              <Text fontSize="$2" fontWeight="600">Force Fetch</Text>
                            </XStack>
                          )}
                        </Button>
                      </XStack>

                      <YStack gap="$2" marginTop="$2" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderColor">
                        <XStack gap="$2" alignItems="center">
                          <Database size={16} color="var(--color-9)" />
                          <Text fontSize="$3" color="$color10">
                            Count: <Text fontWeight="700" color="$color12" fontSize="$4">{status.dataCount}</Text>
                          </Text>
                        </XStack>

                        {status.lastFetched ? (
                          <YStack gap="$1">
                            <XStack gap="$2" alignItems="center">
                              <Clock size={16} color="var(--color-9)" />
                              <Text fontSize="$2" color="$color10">
                                Last Updated:
                              </Text>
                              <Text fontSize="$2" fontWeight="600" color="$color12">
                                {formatDate(status.lastFetched)}
                              </Text>
                            </XStack>
                            {status.hoursSinceLastFetch !== null && (
                              <Text fontSize="$1" color="$color9" paddingLeft="$6">
                                {status.hoursSinceLastFetch < 1
                                  ? `${Math.round(status.hoursSinceLastFetch * 60)} minutes ago`
                                  : status.hoursSinceLastFetch < 24
                                  ? `${Math.round(status.hoursSinceLastFetch)} hours ago`
                                  : `${Math.round(status.hoursSinceLastFetch / 24)} days ago`}
                              </Text>
                            )}
                          </YStack>
                        ) : (
                          <XStack gap="$2" alignItems="center">
                            <AlertCircle size={16} color="var(--color-9)" />
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

        {/* Quests Status */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background" borderColor="$green8">
          <YStack gap="$3">
            <XStack gap="$3" alignItems="center" justifyContent="space-between">
              <XStack gap="$3" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$green4" borderRadius="$3">
                  <Database size={24} color="var(--color-green-10)" />
                </Card>
                <YStack gap="$1">
                  <Text fontSize="$5" fontWeight="800" color="$color12">
                    Wiki Quests
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    Quest data from Escape from Tarkov Wiki
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                theme="green"
                onPress={() => fetchQuestStatus(localStorage.getItem('userId') || '')}
                disabled={loadingQuestStatus}
              >
                {loadingQuestStatus ? (
                  <Spinner size="small" />
                ) : (
                  <XStack gap="$2" alignItems="center">
                    <RefreshCw size={16} />
                    <Text fontSize="$2">Refresh</Text>
                  </XStack>
                )}
              </Button>
            </XStack>

            {loadingQuestStatus ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Spinner size="small" />
                <Text fontSize="$2" color="$color10" marginTop="$2">
                  Loading quest status...
                </Text>
              </Card>
            ) : questStatus ? (
              <YStack gap="$2">
                <XStack gap="$4" flexWrap="wrap">
                  <YStack>
                    <Text fontSize="$1" color="$color10">Total Quests</Text>
                    <Text fontSize="$4" fontWeight="bold" color="$green10">
                      {questStatus.tasksCount || 0}
                    </Text>
                  </YStack>
                  {questStatus.lastFetched && (
                    <YStack>
                      <Text fontSize="$1" color="$color10">Last Updated</Text>
                      <Text fontSize="$2" color="$color12">
                        {formatDate(questStatus.lastFetched.toISOString())}
                      </Text>
                      {questStatus.hoursSinceLastFetch !== null && (
                        <Text fontSize="$1" color="$color9">
                          {questStatus.hoursSinceLastFetch < 1
                            ? `${Math.round(questStatus.hoursSinceLastFetch * 60)} minutes ago`
                            : questStatus.hoursSinceLastFetch < 24
                            ? `${Math.round(questStatus.hoursSinceLastFetch)} hours ago`
                            : `${Math.round(questStatus.hoursSinceLastFetch / 24)} days ago`}
                        </Text>
                      )}
                    </YStack>
                  )}
                  {questStatus.progress && questStatus.progress.totalQuests && (
                    <YStack>
                      <Text fontSize="$1" color="$color10">Scraping Progress</Text>
                      <Text fontSize="$4" fontWeight="bold" color="$blue10">
                        {questStatus.progress.currentIndex || 0}/{questStatus.progress.totalQuests}
                      </Text>
                      <Text fontSize="$1" color="$color9">
                        {questStatus.progress.lastScrapedQuest || 'Starting...'}
                      </Text>
                    </YStack>
                  )}
                </XStack>
                {questStatus.progress && questStatus.progress.totalQuests && (
                  <Card size="$2" bordered padding="$3" backgroundColor="$blue2">
                    <YStack gap="$2">
                      <XStack gap="$2" alignItems="center">
                        <Clock size={14} color="var(--color-blue-10)" />
                        <Text fontSize="$2" fontWeight="600" color="$blue10">
                          Active Scraping
                        </Text>
                      </XStack>
                      <Text fontSize="$1" color="$color11">
                        Currently scraping quest {questStatus.progress.currentIndex || 0} of {questStatus.progress.totalQuests}
                      </Text>
                      {questStatus.progress.lastScrapedQuest && (
                        <Text fontSize="$1" color="$color10">
                          Last scraped: {questStatus.progress.lastScrapedQuest}
                        </Text>
                      )}
                      {questStatus.progress.updatedAt && (
                        <Text fontSize="$1" color="$color9">
                          Updated: {formatDate(questStatus.progress.updatedAt.toISOString())}
                        </Text>
                      )}
                    </YStack>
                  </Card>
                )}
                {!questStatus.cacheExists && (
                  <Card size="$2" bordered padding="$3" backgroundColor="$orange2">
                    <XStack gap="$2" alignItems="center">
                      <AlertCircle size={14} color="var(--color-orange-10)" />
                      <Text fontSize="$2" color="$orange10">
                        No quest data found. Please start scraping quests from wiki.
                      </Text>
                    </XStack>
                  </Card>
                )}
              </YStack>
            ) : (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Text fontSize="$2" color="$color10">
                  No quest status available
                </Text>
              </Card>
            )}
          </YStack>
        </Card>

        {/* Wiki Scraping */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background" borderColor="$purple8">
          <YStack gap="$3">
            <XStack gap="$3" alignItems="center" justifyContent="space-between">
              <XStack gap="$3" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$purple4" borderRadius="$3">
                  <Globe size={24} color="var(--color-purple-10)" />
                </Card>
                <YStack gap="$1">
                  <Text fontSize="$5" fontWeight="800" color="$color12">
                    Wiki Data Scraping
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    Scrape and update quest data from wiki
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                theme="purple"
                onPress={() => fetchWikiStatus(localStorage.getItem('userId') || '')}
                disabled={loadingWikiStatus}
              >
                {loadingWikiStatus ? (
                  <Spinner size="small" />
                ) : (
                  <XStack gap="$2" alignItems="center">
                    <RefreshCw size={16} />
                    <Text fontSize="$2">Refresh</Text>
                  </XStack>
                )}
              </Button>
            </XStack>

            {loadingWikiStatus && (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Spinner size="small" />
                <Text fontSize="$2" color="$color10" marginTop="$2">
                  Loading wiki status...
                </Text>
              </Card>
            )}

            {!loadingWikiStatus && (
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

                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    size="$3"
                    theme="orange"
                    onPress={scrapeWiki}
                    disabled={wikiScraping || missingScraping}
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

                  <Button
                    size="$3"
                    theme="blue"
                    onPress={scrapeMissingQuests}
                    disabled={wikiScraping || missingScraping}
                  >
                    {missingScraping ? (
                      <XStack gap="$2" alignItems="center">
                        <Spinner size="small" />
                        <Text fontSize="$2">Scraping Missing...</Text>
                      </XStack>
                    ) : (
                      <XStack gap="$2" alignItems="center">
                        <Globe size={16} />
                        <Text fontSize="$2">Scrape Missing Quests</Text>
                      </XStack>
                    )}
                  </Button>

                  <Button
                    size="$3"
                    theme="green"
                    onPress={downloadImages}
                    disabled={wikiScraping || missingScraping || downloadingImages}
                  >
                    {downloadingImages ? (
                      <XStack gap="$2" alignItems="center">
                        <Spinner size="small" />
                        <Text fontSize="$2">Downloading Images...</Text>
                      </XStack>
                    ) : (
                      <XStack gap="$2" alignItems="center">
                        <Download size={16} />
                        <Text fontSize="$2">Download Quest Images</Text>
                      </XStack>
                    )}
                  </Button>
                </XStack>

                <Text fontSize="$1" color="$color9">
                  "Scrape Quest Data from Wiki" will scrape all quest pages from the Escape from Tarkov wiki, extract all quest data, 
                  convert to Task format, and save to MongoDB. Only wiki scraping logs will be shown. 
                  This process may take a long time.
                </Text>
                <Text fontSize="$1" color="$color9">
                  "Scrape Missing Quests" will only scrape quests that are not already in the database, making it faster for updates.
                </Text>
                <Text fontSize="$1" color="$color9">
                  "Download Quest Images" will download all quest images from wiki_quests collection and save them as base64 in wiki_images collection for offline use.
                </Text>
              </YStack>
            )}

            {/* Raw Wiki Quest Data */}
            <Card size="$4" bordered padding="$4" backgroundColor="$gray2">
              <XStack gap="$4" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                <YStack gap="$1">
                  <Text fontSize="$5" fontWeight="800" color="$color12">
                    Raw Wiki Quest Data
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    Fetch and store raw HTML from wiki pages
                  </Text>
                </YStack>
                <Button
                  size="$3"
                  theme="green"
                  onPress={() => fetchRawWikiStatus(localStorage.getItem('userId') || '')}
                  disabled={loadingRawWikiStatus}
                >
                  {loadingRawWikiStatus ? (
                    <Spinner size="small" />
                  ) : (
                    <XStack gap="$2" alignItems="center">
                      <RefreshCw size={16} />
                      <Text fontSize="$2">Refresh</Text>
                    </XStack>
                  )}
                </Button>
              </XStack>

              {loadingRawWikiStatus ? (
                <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center" marginTop="$2">
                  <Spinner size="small" />
                  <Text fontSize="$2" color="$color10" marginTop="$2">
                    Loading raw wiki status...
                  </Text>
                </Card>
              ) : (
                <YStack gap="$2" marginTop="$2">
                  {rawWikiStatus && (
                    <XStack gap="$4" flexWrap="wrap">
                      <YStack>
                        <Text fontSize="$1" color="$color10">Total Raw Pages</Text>
                        <Text fontSize="$4" fontWeight="bold" color="$blue10">
                          {rawWikiStatus.total || 0}
                        </Text>
                      </YStack>
                      {rawWikiStatus.newestFetched && (
                        <YStack>
                          <Text fontSize="$1" color="$color10">Newest Fetched</Text>
                          <Text fontSize="$2" color="$color12">
                            {formatDate(rawWikiStatus.newestFetched.toISOString())}
                          </Text>
                        </YStack>
                      )}
                      {rawWikiStatus.oldestFetched && (
                        <YStack>
                          <Text fontSize="$1" color="$color10">Oldest Fetched</Text>
                          <Text fontSize="$2" color="$color12">
                            {formatDate(rawWikiStatus.oldestFetched.toISOString())}
                          </Text>
                        </YStack>
                      )}
                    </XStack>
                  )}

                  <Button
                    size="$3"
                    theme="purple"
                    onPress={fetchRawWikiQuests}
                    disabled={fetchingRawWiki || wikiScraping || missingScraping}
                  >
                    {fetchingRawWiki ? (
                      <XStack gap="$2" alignItems="center">
                        <Spinner size="small" />
                        <Text fontSize="$2">Fetching Raw Wiki...</Text>
                      </XStack>
                    ) : (
                      <XStack gap="$2" alignItems="center">
                        <Database size={16} />
                        <Text fontSize="$2">Fetch Raw Wiki Quest Pages</Text>
                      </XStack>
                    )}
                  </Button>

                  <Text fontSize="$1" color="$color9">
                    "Fetch Raw Wiki Quest Pages" will download all quest pages from the wiki as raw HTML and save them to the raw_wiki_quests collection. 
                    This allows you to scrape the data later without making repeated requests to the wiki. This process may take a long time.
                  </Text>
                </YStack>
              )}
            </Card>

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
                          setShowTestResultRaw(false)
                          
                          try {
                            const userId = localStorage.getItem('userId')
                            if (!userId) {
                              setTestResult({ error: 'Not authenticated' })
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
                              setTestResult(data.result)
                            } else {
                              setTestResult({ error: data.error || 'Unknown error' })
                            }
                          } catch (error) {
                            setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' })
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
                        <YStack gap="$2">
                          <XStack gap="$2" alignItems="center" justifyContent="space-between">
                            <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                              Scraping Result
                            </Text>
                            <Button
                              size="$1"
                              theme="gray"
                              onPress={() => setShowTestResultRaw(!showTestResultRaw)}
                            >
                              <Text fontSize="$1">
                                {showTestResultRaw ? 'Show Formatted' : 'Show Raw JSON'}
                              </Text>
                            </Button>
                          </XStack>
                          
                          {testResult.error ? (
                            <Card size="$2" bordered padding="$3" backgroundColor="$red2">
                              <Text fontSize="$2" color="$red10">
                                Error: {testResult.error}
                              </Text>
                            </Card>
                          ) : showTestResultRaw ? (
                            <ScrollView maxHeight={500}>
                              <Text fontSize="$1" color="#00ff00" fontFamily="monospace" whiteSpace="pre-wrap">
                                {JSON.stringify(testResult, null, 2)}
                              </Text>
                            </ScrollView>
                          ) : (
                            <ScrollView maxHeight={500}>
                              <YStack gap="$3" padding="$2">
                                {/* Basic Info */}
                                <YStack gap="$2">
                                  <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                    Quest Information
                                  </Text>
                                  <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                    <YStack gap="$1">
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Quest Name:
                                        </Text>
                                        <Text fontSize="$1" color="#fff" fontFamily="monospace" flex={1}>
                                          {testResult.questName || 'N/A'}
                                        </Text>
                                      </XStack>
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Wiki URL:
                                        </Text>
                                        <Text fontSize="$1" color="#88aaff" fontFamily="monospace" flex={1} style={{ wordBreak: 'break-all' }}>
                                          {testResult.wikiUrl || 'N/A'}
                                        </Text>
                                      </XStack>
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Location:
                                        </Text>
                                        <Text fontSize="$1" color="#fff" fontFamily="monospace" flex={1}>
                                          {testResult.location || 'N/A'}
                                        </Text>
                                      </XStack>
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Given By:
                                        </Text>
                                        <Text fontSize="$1" color="#fff" fontFamily="monospace" flex={1}>
                                          {testResult.givenBy || 'N/A'}
                                        </Text>
                                      </XStack>
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Min Level:
                                        </Text>
                                        <Text fontSize="$1" color={testResult.minPlayerLevel ? "#00ff00" : "#888"} fontFamily="monospace" flex={1}>
                                          {testResult.minPlayerLevel || 'N/A'}
                                        </Text>
                                      </XStack>
                                      <XStack gap="$2">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                          Kappa Required:
                                        </Text>
                                        <Text fontSize="$1" color={testResult.kappaRequired ? "#ffaa00" : "#888"} fontFamily="monospace" flex={1}>
                                          {testResult.kappaRequired ? 'Yes' : testResult.kappaRequired === false ? 'No' : 'N/A'}
                                        </Text>
                                      </XStack>
                                    </YStack>
                                  </Card>
                                </YStack>

                                {/* Quest Relationships */}
                                {(testResult.previousQuests?.length > 0 || testResult.leadsToQuests?.length > 0) && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Quest Relationships
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      <YStack gap="$2">
                                        {testResult.previousQuests?.length > 0 && (
                                          <YStack gap="$1">
                                            <Text fontSize="$1" color="#ff6666" fontFamily="monospace" fontWeight="600">
                                              Previous Quests ({testResult.previousQuests.length}):
                                            </Text>
                                            {testResult.previousQuests.map((q: string, idx: number) => (
                                              <Text key={idx} fontSize="$1" color="#ff8888" fontFamily="monospace" paddingLeft="$2">
                                                • {q}
                                              </Text>
                                            ))}
                                          </YStack>
                                        )}
                                        {testResult.leadsToQuests?.length > 0 && (
                                          <YStack gap="$1">
                                            <Text fontSize="$1" color="#66ff66" fontFamily="monospace" fontWeight="600">
                                              Leads To Quests ({testResult.leadsToQuests.length}):
                                            </Text>
                                            {testResult.leadsToQuests.map((q: string, idx: number) => (
                                              <Text key={idx} fontSize="$1" color="#88ff88" fontFamily="monospace" paddingLeft="$2">
                                                • {q}
                                              </Text>
                                            ))}
                                          </YStack>
                                        )}
                                      </YStack>
                                    </Card>
                                  </YStack>
                                )}

                                {/* Objectives */}
                                {(testResult.objectives !== undefined && testResult.objectives !== null) && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Objectives ({testResult.objectives?.length || 0})
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      {testResult.objectives && testResult.objectives.length > 0 ? (
                                        <YStack gap="$2">
                                          {testResult.objectives.map((obj: any, idx: number) => (
                                            <Card key={idx} size="$1" bordered padding="$2" backgroundColor={obj.optional ? "#2a2a1a" : "#1a1a1a"}>
                                              <YStack gap="$1">
                                                <XStack gap="$2" alignItems="center">
                                                  <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={60}>
                                                    #{idx + 1}
                                                  </Text>
                                                  <Text fontSize="$1" color={obj.optional ? "#ffaa00" : "#00ff00"} fontFamily="monospace" fontWeight="600">
                                                    {obj.type || 'Objective'}
                                                  </Text>
                                                  {obj.optional && (
                                                    <Text fontSize="$1" color="#ffaa00" fontFamily="monospace">
                                                      (Optional)
                                                    </Text>
                                                  )}
                                                </XStack>
                                                <Text fontSize="$1" color="#ccc" fontFamily="monospace" paddingLeft="$7">
                                                  {obj.description || 'No description'}
                                                </Text>
                                                {obj.maps && obj.maps.length > 0 && (
                                                  <XStack gap="$1" paddingLeft="$7" flexWrap="wrap">
                                                    {obj.maps.map((map: string, mapIdx: number) => (
                                                      <Text key={mapIdx} fontSize="$1" color="#8888ff" fontFamily="monospace">
                                                        {map}{mapIdx < obj.maps.length - 1 ? ',' : ''}
                                                      </Text>
                                                    ))}
                                                  </XStack>
                                                )}
                                              </YStack>
                                            </Card>
                                          ))}
                                        </YStack>
                                      ) : (
                                        <Text fontSize="$1" color="#888" fontFamily="monospace">
                                          No objectives found (may not exist on this page)
                                        </Text>
                                      )}
                                    </Card>
                                  </YStack>
                                )}

                                {/* Guide Steps */}
                                {(testResult.guideSteps !== undefined && testResult.guideSteps !== null) && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Guide Steps ({testResult.guideSteps?.length || 0})
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      {testResult.guideSteps && testResult.guideSteps.length > 0 ? (
                                        <YStack gap="$1">
                                          {testResult.guideSteps.map((step: string, idx: number) => (
                                            <XStack key={idx} gap="$2">
                                              <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={30}>
                                                {idx + 1}.
                                              </Text>
                                              <Text fontSize="$1" color="#ccc" fontFamily="monospace" flex={1}>
                                                {step}
                                              </Text>
                                            </XStack>
                                          ))}
                                        </YStack>
                                      ) : (
                                        <Text fontSize="$1" color="#888" fontFamily="monospace">
                                          No guide steps found (may not exist on this page)
                                        </Text>
                                      )}
                                    </Card>
                                  </YStack>
                                )}

                                {/* Rewards */}
                                {(testResult.rewardsExp || testResult.rewardsRep?.length > 0 || testResult.rewardsOther?.length > 0) && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Rewards
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      <YStack gap="$1">
                                        {testResult.rewardsExp && (
                                          <XStack gap="$2">
                                            <Text fontSize="$1" color="#888" fontFamily="monospace" minWidth={120}>
                                              Experience:
                                            </Text>
                                            <Text fontSize="$1" color="#00ff00" fontFamily="monospace">
                                              +{testResult.rewardsExp.toLocaleString()} EXP
                                            </Text>
                                          </XStack>
                                        )}
                                        {testResult.rewardsRep?.length > 0 && (
                                          <YStack gap="$1">
                                            <Text fontSize="$1" color="#888" fontFamily="monospace">
                                              Reputation:
                                            </Text>
                                            {testResult.rewardsRep.map((rep: any, idx: number) => (
                                              <XStack key={idx} gap="$2" paddingLeft="$4">
                                                <Text fontSize="$1" color="#ccc" fontFamily="monospace">
                                                  {rep.trader}:
                                                </Text>
                                                <Text fontSize="$1" color={rep.amount >= 0 ? "#00ff00" : "#ff6666"} fontFamily="monospace">
                                                  {rep.amount >= 0 ? '+' : ''}{rep.amount}
                                                </Text>
                                              </XStack>
                                            ))}
                                          </YStack>
                                        )}
                                        {testResult.rewardsOther?.length > 0 && (
                                          <YStack gap="$1">
                                            <Text fontSize="$1" color="#888" fontFamily="monospace">
                                              Other Rewards:
                                            </Text>
                                            {testResult.rewardsOther.map((reward: string, idx: number) => (
                                              <Text key={idx} fontSize="$1" color="#ccc" fontFamily="monospace" paddingLeft="$4">
                                                • {reward}
                                              </Text>
                                            ))}
                                          </YStack>
                                        )}
                                      </YStack>
                                    </Card>
                                  </YStack>
                                )}

                                {/* Quest Image */}
                                {testResult.questImage && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Quest Image
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      <YStack gap="$1">
                                        <Text fontSize="$1" color="#888" fontFamily="monospace" style={{ wordBreak: 'break-all' }}>
                                          {testResult.questImage}
                                        </Text>
                                      </YStack>
                                    </Card>
                                  </YStack>
                                )}

                                {/* Requirements */}
                                {testResult.requirements && (
                                  <YStack gap="$2">
                                    <Text fontSize="$2" fontWeight="600" color="#00ff00" fontFamily="monospace">
                                      Requirements
                                    </Text>
                                    <Card size="$2" bordered padding="$2" backgroundColor="#0a0a0a">
                                      <Text fontSize="$1" color="#ccc" fontFamily="monospace" whiteSpace="pre-wrap">
                                        {testResult.requirements}
                                      </Text>
                                    </Card>
                                  </YStack>
                                )}
                              </YStack>
                            </ScrollView>
                          )}
                        </YStack>
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
                      <ScrollView ref={logScrollViewRef} maxHeight={350}>
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
                              <YStack key={index} data-log-index={index === logEntries.length - 1} gap="$1" paddingBottom="$2" borderBottomWidth={1} borderBottomColor="#333">
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
        </Card>

        {/* Users List */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background" borderColor="$yellow8">
          <YStack gap="$3">
            <XStack gap="$3" alignItems="center">
              <Card size="$2" bordered padding="$2" backgroundColor="$yellow4" borderRadius="$3">
                <Users size={24} color="var(--color-yellow-10)" />
              </Card>
              <YStack gap="$1">
                <Text fontSize="$5" fontWeight="800" color="$color12">
                  All Users
                </Text>
                <Text fontSize="$2" color="$color10">
                  {totalUsers} registered user{totalUsers !== 1 ? 's' : ''}
                </Text>
              </YStack>
            </XStack>
            
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

        {/* Quest Management */}
        <Card elevate size="$4" bordered padding="$4" backgroundColor="$background" borderColor="$blue8">
          <YStack gap="$3">
            <XStack gap="$3" alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <XStack gap="$3" alignItems="center">
                <Card size="$2" bordered padding="$2" backgroundColor="$blue4" borderRadius="$3">
                  <Database size={24} color="var(--color-blue-10)" />
                </Card>
                <YStack gap="$1">
                  <Text fontSize="$5" fontWeight="800" color="$color12">
                    Quest Management
                  </Text>
                  <Text fontSize="$2" color="$color10">
                    Edit and manage quest data manually
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                theme="blue"
                onPress={() => {
                  const userId = localStorage.getItem('userId') || ''
                  fetchQuests(userId)
                }}
                disabled={loadingQuests}
              >
                {loadingQuests ? (
                  <Spinner size="small" />
                ) : (
                  <XStack gap="$2" alignItems="center">
                    <RefreshCw size={16} />
                    <Text fontSize="$2">Refresh</Text>
                  </XStack>
                )}
              </Button>
            </XStack>

            {/* Search */}
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                placeholder="Search quests by name..."
                value={questSearchQuery}
                onChangeText={setQuestSearchQuery}
                borderColor="$borderColor"
                backgroundColor="$background"
                color="$color12"
                fontSize="$2"
              />
              {questSearchQuery && (
                <Button
                  size="$2"
                  theme="gray"
                  circular
                  onPress={() => setQuestSearchQuery('')}
                >
                  <X size={14} />
                </Button>
              )}
            </XStack>

            {loadingQuests ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Spinner size="small" />
                <Text fontSize="$2" color="$color10" marginTop="$2">
                  Loading quests...
                </Text>
              </Card>
            ) : allQuests.length === 0 ? (
              <Card size="$2" bordered padding="$4" backgroundColor="$gray2" alignItems="center">
                <Text fontSize="$2" color="$color10">
                  No quests found. Please scrape quests from wiki first.
                </Text>
              </Card>
            ) : (
              <ScrollView maxHeight="calc(100vh - 500px)">
                <YStack gap="$2">
                  {allQuests
                    .filter(quest =>
                      questSearchQuery
                        ? quest.name.toLowerCase().includes(questSearchQuery.toLowerCase())
                        : true
                    )
                    .map((quest) => (
                      <Card
                        key={quest.id}
                        size="$3"
                        bordered
                        padding="$3"
                        backgroundColor="$background"
                        borderColor="$borderColor"
                      >
                        <XStack gap="$3" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                          <YStack flex={1} minWidth={200} gap="$1">
                            <XStack gap="$2" alignItems="center" flexWrap="wrap">
                              <Text fontSize="$3" fontWeight="600" color="$color12">
                                {quest.name}
                              </Text>
                              {quest.trader && (
                                <XStack
                                  gap="$1"
                                  alignItems="center"
                                  paddingHorizontal="$2"
                                  paddingVertical="$1"
                                  backgroundColor="$blue4"
                                  borderRadius="$2"
                                >
                                  <Text fontSize="$1" color="$blue10" fontWeight="600">
                                    {quest.trader.name}
                                  </Text>
                                </XStack>
                              )}
                            </XStack>
                            <XStack gap="$4" flexWrap="wrap">
                              {quest.minPlayerLevel && (
                                <Text fontSize="$1" color="$color9">
                                  Level: {quest.minPlayerLevel}
                                </Text>
                              )}
                              {quest.taskRequirements && quest.taskRequirements.length > 0 && (
                                <Text fontSize="$1" color="$color9">
                                  Prerequisites: {quest.taskRequirements.length}
                                </Text>
                              )}
                              {quest.wikiLink && (
                                <Text fontSize="$1" color="$color9" style={{ wordBreak: 'break-all' }}>
                                  {quest.wikiLink}
                                </Text>
                              )}
                            </XStack>
                          </YStack>
                          <Button
                            size="$2"
                            theme="blue"
                            onPress={() => handleEditQuest(quest)}
                          >
                            <XStack gap="$1" alignItems="center">
                              <Edit size={14} />
                              <Text fontSize="$1">Edit</Text>
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

      {/* Edit Quest Modal */}
      <Dialog modal open={editModalOpen} onOpenChange={setEditModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            bordered
            elevate
            key="content"
            animateOnly={['transform', 'opacity']}
            animation={[
              'quick',
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
            maxWidth={900}
            maxHeight="90vh"
            backgroundColor="$background"
          >
            <Dialog.Title fontSize="$6" fontWeight="800" color="$color12">
              Edit Quest: {editingQuest?.name}
            </Dialog.Title>

            {editingQuest && (
              <ScrollView maxHeight="calc(90vh - 150px)">
                <YStack gap="$4" padding="$2">
                  {/* Basic Info */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$color12">
                      Basic Information
                    </Text>
                    <Card size="$2" bordered padding="$3" backgroundColor="$gray2">
                      <YStack gap="$2">
                        <XStack gap="$2" alignItems="center">
                          <Text fontSize="$2" color="$color10" minWidth={120}>
                            Quest ID:
                          </Text>
                          <Input
                            flex={1}
                            value={editingQuest.id}
                            onChangeText={(text) => setEditingQuest({ ...editingQuest, id: text })}
                            borderColor="$borderColor"
                            backgroundColor="$background"
                            color="$color12"
                            fontSize="$2"
                          />
                        </XStack>
                        <XStack gap="$2" alignItems="center">
                          <Text fontSize="$2" color="$color10" minWidth={120}>
                            Quest Name:
                          </Text>
                          <Input
                            flex={1}
                            value={editingQuest.name}
                            onChangeText={(text) => setEditingQuest({ ...editingQuest, name: text })}
                            borderColor="$borderColor"
                            backgroundColor="$background"
                            color="$color12"
                            fontSize="$2"
                          />
                        </XStack>
                        <XStack gap="$2" alignItems="center">
                          <Text fontSize="$2" color="$color10" minWidth={120}>
                            Min Level:
                          </Text>
                          <Input
                            flex={1}
                            value={editingQuest.minPlayerLevel?.toString() || ''}
                            onChangeText={(text) =>
                              setEditingQuest({
                                ...editingQuest,
                                minPlayerLevel: text ? parseInt(text, 10) : undefined,
                              })
                            }
                            borderColor="$borderColor"
                            backgroundColor="$background"
                            color="$color12"
                            fontSize="$2"
                            keyboardType="numeric"
                          />
                        </XStack>
                        <XStack gap="$2" alignItems="center">
                          <Text fontSize="$2" color="$color10" minWidth={120}>
                            Experience:
                          </Text>
                          <Input
                            flex={1}
                            value={editingQuest.experience?.toString() || ''}
                            onChangeText={(text) =>
                              setEditingQuest({
                                ...editingQuest,
                                experience: text ? parseInt(text, 10) : undefined,
                              })
                            }
                            borderColor="$borderColor"
                            backgroundColor="$background"
                            color="$color12"
                            fontSize="$2"
                            keyboardType="numeric"
                          />
                        </XStack>
                        <XStack gap="$2" alignItems="center">
                          <Text fontSize="$2" color="$color10" minWidth={120}>
                            Wiki URL:
                          </Text>
                          <Input
                            flex={1}
                            value={editingQuest.wikiLink || ''}
                            onChangeText={(text) =>
                              setEditingQuest({ ...editingQuest, wikiLink: text || undefined })
                            }
                            borderColor="$borderColor"
                            backgroundColor="$background"
                            color="$color12"
                            fontSize="$2"
                          />
                        </XStack>
                      </YStack>
                    </Card>
                  </YStack>

                  {/* Task Requirements */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$color12">
                      Prerequisites (Task Requirements)
                    </Text>
                    <Card size="$2" bordered padding="$3" backgroundColor="$gray2">
                      <YStack gap="$2">
                        {editingQuest.taskRequirements && editingQuest.taskRequirements.length > 0 ? (
                          editingQuest.taskRequirements.map((req, idx) => (
                            <XStack key={idx} gap="$2" alignItems="center">
                              <Text fontSize="$2" color="$color10" minWidth={80}>
                                #{idx + 1}
                              </Text>
                              <Input
                                flex={1}
                                value={req.task.name}
                                onChangeText={(text) => {
                                  const newReqs = [...(editingQuest.taskRequirements || [])]
                                  newReqs[idx] = {
                                    ...req,
                                    task: { ...req.task, name: text },
                                  }
                                  setEditingQuest({ ...editingQuest, taskRequirements: newReqs })
                                }}
                                borderColor="$borderColor"
                                backgroundColor="$background"
                                color="$color12"
                                fontSize="$2"
                                placeholder="Quest name"
                              />
                              <Input
                                flex={1}
                                value={req.task.id}
                                onChangeText={(text) => {
                                  const newReqs = [...(editingQuest.taskRequirements || [])]
                                  newReqs[idx] = {
                                    ...req,
                                    task: { ...req.task, id: text },
                                  }
                                  setEditingQuest({ ...editingQuest, taskRequirements: newReqs })
                                }}
                                borderColor="$borderColor"
                                backgroundColor="$background"
                                color="$color12"
                                fontSize="$2"
                                placeholder="Quest ID"
                              />
                              <Button
                                size="$2"
                                theme="red"
                                onPress={() => {
                                  const newReqs = editingQuest.taskRequirements?.filter((_, i) => i !== idx) || []
                                  setEditingQuest({ ...editingQuest, taskRequirements: newReqs })
                                }}
                              >
                                <X size={12} />
                              </Button>
                            </XStack>
                          ))
                        ) : (
                          <Text fontSize="$1" color="$color9">
                            No prerequisites
                          </Text>
                        )}
                        <Button
                          size="$2"
                          theme="green"
                          onPress={() => {
                            const newReqs = [
                              ...(editingQuest.taskRequirements || []),
                              {
                                task: { id: '', name: '', normalizedName: '' },
                                status: ['Started', 'AvailableForStart'],
                              },
                            ]
                            setEditingQuest({ ...editingQuest, taskRequirements: newReqs })
                          }}
                        >
                          <Text fontSize="$1">+ Add Prerequisite</Text>
                        </Button>
                      </YStack>
                    </Card>
                  </YStack>

                  {/* JSON Editor (for advanced editing) */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$color12">
                      Advanced: Raw JSON
                    </Text>
                    <Card size="$2" bordered padding="$3" backgroundColor="$gray2">
                      <ScrollView maxHeight={300}>
                        <Input
                          multiline
                          numberOfLines={10}
                          value={JSON.stringify(editingQuest, null, 2)}
                          onChangeText={(text) => {
                            try {
                              const parsed = JSON.parse(text)
                              setEditingQuest(parsed)
                            } catch (e) {
                              // Invalid JSON, ignore
                            }
                          }}
                          borderColor="$borderColor"
                          backgroundColor="#1a1a1a"
                          color="#00ff00"
                          fontSize="$1"
                          fontFamily="monospace"
                          padding="$2"
                        />
                      </ScrollView>
                    </Card>
                  </YStack>
                </YStack>
              </ScrollView>
            )}

            <XStack gap="$3" justifyContent="flex-end">
              <Dialog.Close displayWhenAdapted asChild>
                <Button
                  theme="gray"
                  onPress={() => {
                    setEditModalOpen(false)
                    setEditingQuest(null)
                  }}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                theme="blue"
                onPress={handleSaveQuest}
                disabled={savingQuest || !editingQuest}
              >
                {savingQuest ? (
                  <XStack gap="$2" alignItems="center">
                    <Spinner size="small" />
                    <Text>Saving...</Text>
                  </XStack>
                ) : (
                  <Text>Save Changes</Text>
                )}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Footer />
    </YStack>
  )
}

