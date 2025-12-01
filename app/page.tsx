'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Card, H1, Text, XStack, YStack, Spinner, ScrollView, Input } from 'tamagui'
import { RefreshCw, AlertCircle, Plus, Minus, Filter, Network } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { QuestCard } from './components/QuestCard'
import { QuestDetailModal } from './components/QuestDetailModal'
import { TraderCard } from './components/TraderCard'
import { MapFilter } from './components/MapFilter'
import { UserAuth } from './components/UserAuth'
import { Footer } from './components/Footer'
import { 
  filterQuestsByTrader,
  filterQuestsByMap,
  filterQuestsByLevel,
  sortQuestsByAvailability,
  type Task
} from '@/lib/utils/questTree'
import {
  getDoneQuestIds,
  toggleQuestDone,
  isQuestUnlocked,
  getQuestsUnlockedByQuest
} from '@/lib/utils/questProgress'

interface QuestData {
  tasks?: Task[]
}

interface TradersData {
  traders?: Array<{
    id: string
    name: string
    image4xLink?: string
  }>
}

interface FetchResponse {
  success: boolean
  cached?: boolean
  message?: string
  lastFetched?: string
  data?: QuestData | TradersData
  error?: string
}

interface StatusResponse {
  success: boolean
  lastFetched: string | null
  shouldFetch: boolean
  hoursSinceLastFetch: number | null
  cacheValid: boolean
}

export default function HomePage() {
  const router = useRouter()
  const [quests, setQuests] = useState<Task[]>([])
  const [traders, setTraders] = useState<Array<{ id: string; name: string; image4xLink?: string }>>([])
  const [selectedTrader, setSelectedTrader] = useState<string | null>(null)
  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [playerLevel, setPlayerLevel] = useState<number>(1)
  const [doneQuestIds, setDoneQuestIds] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState<boolean>(false)
  const [selectedQuest, setSelectedQuest] = useState<Task | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [savingProgress, setSavingProgress] = useState(false)

  // Load user and data on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    const storedLevel = localStorage.getItem('playerLevel')
    const storedDoneQuests = localStorage.getItem('tarkov-quest-done')
    
    if (storedUserId) {
      setUserId(storedUserId)
    }
    
    if (storedLevel) {
      const level = parseInt(storedLevel, 10)
      if (!isNaN(level)) {
        setPlayerLevel(level)
      }
    }
    
    if (storedDoneQuests) {
      try {
        const doneIds = JSON.parse(storedDoneQuests)
        setDoneQuestIds(new Set(doneIds))
      } catch {
        setDoneQuestIds(getDoneQuestIds())
      }
    } else {
      setDoneQuestIds(getDoneQuestIds())
    }

    // Load user data from server if logged in
    if (storedUserId) {
      loadUserData(storedUserId)
    }
  }, [])

  const loadUserData = async (id: string) => {
    try {
      const response = await fetch('/api/auth/user', {
        headers: {
          'x-user-id': id,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          if (data.user.playerLevel) {
            setPlayerLevel(data.user.playerLevel)
            localStorage.setItem('playerLevel', data.user.playerLevel.toString())
          }
          
          if (data.user.completedQuestIds && data.user.completedQuestIds.length > 0) {
            const doneIds = new Set<string>(data.user.completedQuestIds)
            setDoneQuestIds(doneIds)
            localStorage.setItem('tarkov-quest-done', JSON.stringify(Array.from(doneIds)))
          }

          if (data.user.isAdmin !== undefined) {
            setIsAdmin(data.user.isAdmin)
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const saveProgress = useCallback(async () => {
    if (!userId) return
    
    setSavingProgress(true)
    try {
      const response = await fetch('/api/auth/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          playerLevel,
          completedQuestIds: Array.from(doneQuestIds),
        }),
      })
      
      if (!response.ok) {
        console.error('Failed to save progress')
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    } finally {
      setSavingProgress(false)
    }
  }, [userId, playerLevel, doneQuestIds])

  // Auto-save progress when level or done quests change (debounced)
  useEffect(() => {
    if (!userId) return
    
    const timeoutId = setTimeout(() => {
      saveProgress()
    }, 2000) // Debounce 2 seconds
    
    return () => clearTimeout(timeoutId)
  }, [playerLevel, doneQuestIds, userId, saveProgress])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/tarkov/status?queryName=quests')
      const data: StatusResponse = await response.json()
      setStatus(data)
    } catch (err) {
      console.error('Error fetching status:', err)
    }
  }

  const fetchTraders = async () => {
    try {
      const response = await fetch('/api/tarkov/traders')
      const result: FetchResponse = await response.json()
      
      if (result.success && result.data && 'traders' in result.data) {
        setTraders(result.data.traders || [])
      }
    } catch (err) {
      console.error('Error fetching traders:', err)
    }
  }

  const fetchQuests = async (force: boolean = false) => {
    setLoading(true)
    setError(null)

    try {
      // Use data endpoint for reading (everyone can access)
      const url = '/api/tarkov/data?queryName=quests'
      const response = await fetch(url)
      const result: FetchResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch quests')
      }

      if (result.data && 'tasks' in result.data) {
        setQuests(result.data.tasks || [])
      }

      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error fetching quests:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const forceRefresh = async () => {
    if (!isAdmin || !userId) {
      setError('Only admins can refresh data')
      return
    }

    setRefreshing(true)
    setError(null)

    try {
      // Use fetch endpoint for updating (admin only)
      const url = '/api/tarkov/fetch?queryName=quests&force=true'
      const headers: Record<string, string> = {
        'x-user-id': userId,
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })
      const result: FetchResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh quests')
      }

      if (result.data && 'tasks' in result.data) {
        setQuests(result.data.tasks || [])
      }

      await Promise.all([fetchQuests(), fetchTraders(), fetchStatus()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Error refreshing quests:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const loadData = async () => {
    await fetchTraders()

    try {
      const response = await fetch('/api/tarkov/data?queryName=quests')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data && 'tasks' in result.data) {
          setQuests(result.data.tasks || [])
        }
      }
    } catch (err) {
      console.error('Error loading cached data:', err)
    }

    await fetchStatus()
    
    if (!status?.cacheValid || quests.length === 0) {
      await fetchQuests()
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter, sort and prepare quests for display
  const displayedQuests = useMemo(() => {
    let filteredQuests = quests

    // Filter by trader
    if (selectedTrader) {
      filteredQuests = filterQuestsByTrader(filteredQuests, selectedTrader)
    }

    // Filter by map
    if (selectedMap) {
      filteredQuests = filterQuestsByMap(filteredQuests, selectedMap)
    }

    // Filter by level
    filteredQuests = filterQuestsByLevel(filteredQuests, playerLevel)

    // Filter by unlocked status (show only unlocked quests)
    filteredQuests = filteredQuests.filter(q => isQuestUnlocked(q, doneQuestIds))

    // Filter out completed quests if showCompleted is false
    if (!showCompleted) {
      filteredQuests = filteredQuests.filter(q => !doneQuestIds.has(q.id))
    }

    // Sort: available quests first, then by level requirement
    // But put completed quests at the end
    filteredQuests = sortQuestsByAvailability(filteredQuests, playerLevel)
    
    // Separate completed and not completed quests
    const notCompleted = filteredQuests.filter(q => !doneQuestIds.has(q.id))
    const completed = filteredQuests.filter(q => doneQuestIds.has(q.id))
    
    // Return not completed first, then completed at the end
    return [...notCompleted, ...completed]
  }, [quests, selectedTrader, selectedMap, playerLevel, doneQuestIds, showCompleted])

  const availableQuestCount = useMemo(() => {
    return displayedQuests.length
  }, [displayedQuests])

  // Helper function to count available quests for a trader
  const getAvailableQuestCount = useCallback((traderId: string | null) => {
    return quests.filter(q => {
      // Filter by trader if specified
      if (traderId !== null && q.trader?.id !== traderId) return false
      // Exclude completed quests
      if (doneQuestIds.has(q.id)) return false
      // Exclude locked quests (prerequisites not met)
      if (!isQuestUnlocked(q, doneQuestIds)) return false
      // Exclude quests with insufficient level
      if (q.minPlayerLevel && playerLevel < q.minPlayerLevel) return false
      return true
    }).length
  }, [quests, doneQuestIds, playerLevel])

  const handleToggleDone = (questId: string) => {
    const newDoneIds = toggleQuestDone(questId, doneQuestIds)
    setDoneQuestIds(newDoneIds)
    
    // Check if any new quests were unlocked
    const unlockedQuests = getQuestsUnlockedByQuest(quests, questId)
    if (unlockedQuests.length > 0) {
      console.log(`Unlocked ${unlockedQuests.length} quest(s) by completing this quest`)
    }
  }

  const handleQuestCardPress = (quest: Task) => {
    setSelectedQuest(quest)
    setDetailModalOpen(true)
  }

  const increaseLevel = () => setPlayerLevel(prev => prev + 1)
  const decreaseLevel = () => setPlayerLevel(prev => Math.max(1, prev - 1))

  return (
    <YStack
      fullscreen
      backgroundColor="$background"
      padding="$2"
      gap="$2"
    >
      <YStack gap="$2" maxWidth={1800} width="100%" marginHorizontal="auto">
        {/* Header */}
        <XStack gap="$2" alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <XStack gap="$2" alignItems="center">
            <img
              src="/logo.png"
              alt="caca's Tarkov Tracker"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
            <YStack gap="$0">
              <H1 size="$7" color="$color12">
                caca's Tarkov Tracker
              </H1>
              <Text fontSize="$1" color="$color9">
                v0.1.0-beta
              </Text>
            </YStack>
          </XStack>
          
          <XStack gap="$2" alignItems="center">
            <Button
              size="$2"
              theme="purple"
              onPress={() => router.push('/graph')}
            >
              <XStack gap="$1" alignItems="center">
                <Network size={14} />
                <Text fontSize="$1">Graph</Text>
              </XStack>
            </Button>
            <UserAuth />
            {savingProgress && (
              <Text fontSize="$1" color="$color10">
                Saving...
              </Text>
            )}
            {isAdmin && (
              <XStack gap="$1" alignItems="center">
                <Button
                  size="$2"
                  theme="orange"
                  onPress={forceRefresh}
                  disabled={loading || refreshing}
                >
                  {refreshing ? <Spinner size="small" /> : <RefreshCw size={12} />}
                </Button>
              </XStack>
            )}
          </XStack>
        </XStack>

        {/* Player Level Control */}
        <Card elevate size="$2" bordered padding="$1.5" backgroundColor="$background">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontSize="$2" fontWeight="600">Level:</Text>
            <Button
              size="$1"
              circular
              onPress={decreaseLevel}
              disabled={playerLevel <= 1}
            >
              <Minus size={12} />
            </Button>
            <Input
              value={playerLevel.toString()}
              onChangeText={(text) => {
                const num = parseInt(text, 10)
                if (!isNaN(num) && num >= 1) {
                  setPlayerLevel(num)
                }
              }}
              width={50}
              textAlign="center"
              fontSize="$3"
              fontWeight="600"
              keyboardType="numeric"
            />
            <Button
              size="$1"
              circular
              onPress={increaseLevel}
            >
              <Plus size={12} />
            </Button>
            <Text fontSize="$1" color="$color10" marginLeft="$2">
              {availableQuestCount} available
            </Text>
            <Text fontSize="$1" color="$green10" marginLeft="$2">
              {doneQuestIds.size} completed
            </Text>
            <Button
              size="$2"
              theme={showCompleted ? 'green' : 'gray'}
              onPress={() => setShowCompleted(!showCompleted)}
              marginLeft="$2"
            >
              <Text fontSize="$1">
                {showCompleted ? 'Hide Completed' : 'Show Completed'}
              </Text>
            </Button>
            {selectedMap && (
              <Button
                size="$1"
                theme="gray"
                onPress={() => setSelectedMap(null)}
              >
                <Text fontSize="$1">Clear Map Filter</Text>
              </Button>
            )}
          </XStack>
        </Card>

        {/* Trader Filter Cards */}
        <Card elevate size="$2" bordered padding="$1.5" backgroundColor="$background">
          <YStack gap="$1.5">
            <XStack gap="$1" alignItems="center">
              <Filter size={12} />
              <Text fontSize="$2" fontWeight="600">Filter by Trader:</Text>
            </XStack>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$1.5">
                <TraderCard
                  trader={{ id: 'all', name: 'All' }}
                  isSelected={selectedTrader === null}
                  questCount={getAvailableQuestCount(null)}
                  onPress={() => setSelectedTrader(null)}
                />
                {traders.map((trader) => {
                  const traderQuestCount = getAvailableQuestCount(trader.id)
                  return (
                    <TraderCard
                      key={trader.id}
                      trader={trader}
                      isSelected={selectedTrader === trader.id}
                      questCount={traderQuestCount}
                      onPress={() => setSelectedTrader(
                        selectedTrader === trader.id ? null : trader.id
                      )}
                    />
                  )
                })}
              </XStack>
            </ScrollView>
          </YStack>
        </Card>

        {error && (
          <Card elevate size="$2" bordered padding="$1.5" backgroundColor="$red2">
            <XStack gap="$1" alignItems="center">
              <AlertCircle size={14} color="red" />
              <Text fontSize="$1" color="$red10">{error}</Text>
            </XStack>
          </Card>
        )}

        {/* Main Content: Map on Left, Quests on Right */}
        <XStack gap="$2" alignItems="flex-start" width="100%">
          {/* Left Sidebar: Map Filter */}
          <Card
            elevate
            size="$3"
            bordered
            padding="$2"
            backgroundColor="$background"
            width={750}
            minWidth={650}
            maxHeight="calc(100vh - 300px)"
            position="sticky"
            top="$2"
            flexShrink={0}
          >
            <YStack gap="$2" height="100%">
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  Map Filter
                </Text>
                {selectedMap && (
                  <Button
                    size="$1"
                    theme="gray"
                    onPress={() => setSelectedMap(null)}
                  >
                    <Text fontSize="$1">Clear</Text>
                  </Button>
                )}
              </XStack>
              <ScrollView height="100%" showsVerticalScrollIndicator={false}>
                <MapFilter
                  quests={quests}
                  selectedMap={selectedMap}
                  onMapSelect={setSelectedMap}
                  selectedTrader={selectedTrader}
                  playerLevel={playerLevel}
                  doneQuestIds={doneQuestIds}
                />
              </ScrollView>
            </YStack>
          </Card>

          {/* Right Side: Quest List */}
          <YStack flex={1} gap="$2" minWidth={0}>
            {loading && quests.length === 0 ? (
              <Card elevate size="$2" bordered padding="$4" backgroundColor="$background" alignItems="center">
                <Spinner size="large" />
                <Text marginTop="$2" fontSize="$1" color="$color11">Loading...</Text>
              </Card>
            ) : (
              <ScrollView width="100%" maxHeight="calc(100vh - 300px)">
                <YStack gap="$1" width="100%">
                  {displayedQuests.length > 0 ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '8px',
                      }}
                    >
                      {displayedQuests.map((quest) => (
                        <QuestCard
                          key={quest.id}
                          quest={quest}
                          playerLevel={playerLevel}
                          isDone={doneQuestIds.has(quest.id)}
                          isUnlocked={isQuestUnlocked(quest, doneQuestIds)}
                          onToggleDone={() => handleToggleDone(quest.id)}
                          onPress={() => handleQuestCardPress(quest)}
                        />
                      ))}
        </div>
                  ) : (
                    !loading && (
                      <Card elevate size="$2" bordered padding="$3" backgroundColor="$background" alignItems="center">
                        <Text fontSize="$1" color="$color11">
                          {selectedMap 
                            ? `No quests available for this map.`
                            : selectedTrader 
                            ? 'No quests available for this trader.'
                            : 'No unlocked quests available for your level.'
                          }
                        </Text>
                      </Card>
                    )
                  )}
                </YStack>
              </ScrollView>
            )}
          </YStack>
        </XStack>

        {/* Quest Detail Modal */}
        {selectedQuest && (
          <QuestDetailModal
            quest={selectedQuest}
            playerLevel={playerLevel}
            isDone={doneQuestIds.has(selectedQuest.id)}
            isUnlocked={isQuestUnlocked(selectedQuest, doneQuestIds)}
            open={detailModalOpen}
            onOpenChange={setDetailModalOpen}
            onToggleDone={() => {
              handleToggleDone(selectedQuest.id)
            }}
          />
        )}
      </YStack>
      <Footer />
    </YStack>
  )
}
