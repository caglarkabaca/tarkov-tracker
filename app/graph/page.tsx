'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Card, H1, Text, XStack, YStack, Spinner } from 'tamagui'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '@/lib/utils/questTree'
import { filterQuestsByTrader } from '@/lib/utils/questTree'
import { buildQuestGraph, type QuestNodeData } from '@/lib/utils/questGraph'
import { getLayoutedElements } from '@/lib/utils/questGraphLayout'
import { getDoneQuestIds, toggleQuestDone, isQuestUnlocked } from '@/lib/utils/questProgress'
import { QuestDetailModal } from '../components/QuestDetailModal'
import { QuestNode } from '../components/QuestNode'

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
  data?: QuestData | TradersData
  error?: string
}

const nodeTypes = {
  questNode: QuestNode,
}

function QuestGraphContent() {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const [quests, setQuests] = useState<Task[]>([])
  const [traders, setTraders] = useState<Array<{ id: string; name: string; image4xLink?: string }>>([])
  const [selectedTrader, setSelectedTrader] = useState<string | null>(null)
  const [doneQuestIds, setDoneQuestIds] = useState<Set<string>>(new Set())
  const [playerLevel, setPlayerLevel] = useState<number>(1)
  const [selectedQuest, setSelectedQuest] = useState<Task | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // React Flow states
  const initialNodes: Node[] = []
  const initialEdges: Edge[] = []
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    // Load player level and done quests from localStorage
    const storedLevel = localStorage.getItem('playerLevel')
    if (storedLevel) {
      const level = parseInt(storedLevel, 10)
      if (!isNaN(level)) {
        setPlayerLevel(level)
      }
    }
    
    setDoneQuestIds(getDoneQuestIds())
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [questsRes, tradersRes] = await Promise.all([
        fetch('/api/tarkov/data?queryName=quests'),
        fetch('/api/tarkov/traders'),
      ])

      const questsResult: FetchResponse = await questsRes.json()
      const tradersResult: FetchResponse = await tradersRes.json()

      if (questsResult.success && questsResult.data && 'tasks' in questsResult.data) {
        const tasks = questsResult.data.tasks || []
        setQuests(tasks)
      }

      if (tradersResult.success && tradersResult.data && 'traders' in tradersResult.data) {
        const traderList = tradersResult.data.traders || []
        setTraders(traderList)
        
        if (traderList.length > 0) {
          setSelectedTrader(traderList[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get quests for selected trader
  const traderQuests = useMemo(() => {
    if (!selectedTrader) return []
    return filterQuestsByTrader(quests, selectedTrader)
  }, [quests, selectedTrader])

  // Build graph structure and apply automatic layout
  useEffect(() => {
    if (traderQuests.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const graphData = buildQuestGraph(traderQuests, doneQuestIds, playerLevel)
    
    // Validate all nodes have valid positions
    const validNodes = graphData.nodes.filter(node => {
      const isValid = node.position && 
        typeof node.position.x === 'number' && 
        typeof node.position.y === 'number' &&
        Number.isFinite(node.position.x) && 
        Number.isFinite(node.position.y)
      
      if (!isValid) {
        console.warn(`Invalid node position for ${node.id}:`, node.position)
      }
      
      return isValid
    })
    
    // Apply automatic layout using dagre
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      validNodes,
      graphData.edges,
      'LR' // Left to Right
    )
    
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    
    // Fit view after layout
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 })
    }, 100)
  }, [traderQuests, doneQuestIds, setNodes, setEdges, fitView])

  const handleQuestClick = useCallback((quest: Task) => {
    setSelectedQuest(quest)
    setDetailModalOpen(true)
  }, [])

  const handleToggleDone = useCallback((questId: string) => {
    const newDoneIds = toggleQuestDone(questId, doneQuestIds)
    setDoneQuestIds(newDoneIds)
  }, [doneQuestIds])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as QuestNodeData
    if (nodeData?.quest) {
      handleQuestClick(nodeData.quest)
    }
  }, [handleQuestClick])

  if (loading) {
    return (
      <YStack fullscreen backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack fullscreen backgroundColor="$background" padding="$2" gap="$2">
      <YStack gap="$2" maxWidth={1800} width="100%" marginHorizontal="auto">
        {/* Header */}
        <XStack gap="$2" alignItems="center" justifyContent="space-between">
          <XStack gap="$2" alignItems="center">
            <Button
              size="$2"
              theme="gray"
              onPress={() => router.push('/')}
            >
              <ArrowLeft size={16} />
            </Button>
            <H1 size="$7" color="$color12">
              Quest Graph
            </H1>
          </XStack>
        </XStack>

        {/* Trader Tabs */}
        {traders.length > 0 && (
          <Card elevate size="$2" bordered padding="$2" backgroundColor="$background">
            <XStack gap="$2" flexWrap="wrap">
              {traders.map(trader => {
                const traderQuestCount = quests.filter(q => q.trader?.id === trader.id).length
                const isSelected = selectedTrader === trader.id
                return (
                  <Button
                    key={trader.id}
                    theme={isSelected ? 'blue' : 'gray'}
                    onPress={() => setSelectedTrader(trader.id)}
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                  >
                    <XStack gap="$2" alignItems="center">
                      {trader.image4xLink && (
                        <Card size="$1" bordered overflow="hidden" width={24} height={24}>
                          <img
                            src={trader.image4xLink}
                            alt={trader.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </Card>
                      )}
                      <Text fontSize="$2" fontWeight="600">
                        {trader.name} ({traderQuestCount})
                      </Text>
                    </XStack>
                  </Button>
                )
              })}
            </XStack>
          </Card>
        )}

        {/* Graph Visualization */}
        {nodes.length > 0 ? (
          <Card elevate size="$4" bordered padding="$0" backgroundColor="$background" overflow="hidden" position="relative">
            <div style={{ width: '100%', height: 'calc(100vh - 250px)', minHeight: 600 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                minZoom={0.2}
                maxZoom={2}
                panOnDrag={true}
                panOnScroll={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                selectionOnDrag={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
                colorMode="dark"
              >
                <Background gap={12} size={1} />
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    const data = node.data as QuestNodeData
                    if (data?.isCompleted) return '#10b981'
                    if (data?.isIsolated) return '#1e3a8a'
                    return '#1f2937'
                  }}
                  maskColor="rgba(0, 0, 0, 0.6)"
                  style={{ backgroundColor: '#111827', border: '1px solid #374151' }}
                />
              </ReactFlow>
            </div>
          </Card>
        ) : (
          <Card elevate size="$2" bordered padding="$4" backgroundColor="$background" alignItems="center">
            <Text fontSize="$2" color="$color10">
              No quests found for this trader.
            </Text>
          </Card>
        )}
      </YStack>

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
  )
}

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <QuestGraphContent />
    </ReactFlowProvider>
  )
}
