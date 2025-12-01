'use client'

import { Dialog, Adapt, Sheet, Button, Card, Text, XStack, YStack, ScrollView } from 'tamagui'
import { X, ExternalLink, CheckCircle2, Circle, Award, TrendingUp, AlertTriangle } from 'lucide-react'
import type { Task } from '@/lib/utils/questTree'
import { canTakeQuest } from '@/lib/utils/questTree'

interface QuestDetailModalProps {
  quest: Task | null
  playerLevel: number
  isDone: boolean
  isUnlocked: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleDone: () => void
}

export function QuestDetailModal({
  quest,
  playerLevel,
  isDone,
  isUnlocked,
  open,
  onOpenChange,
  onToggleDone,
}: QuestDetailModalProps) {
  if (!quest) return null

  const isAvailable = canTakeQuest(quest, playerLevel)
  const isLocked = !isUnlocked && quest.taskRequirements && quest.taskRequirements.length > 0

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Adapt when="sm" platform="touch">
        <Sheet zIndex={200000} modal dismissOnSnapToBottom>
          <Sheet.Frame padding="$4" gap="$4" backgroundColor="$background">
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay />
        </Sheet>
      </Adapt>

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
          maxWidth={700}
          backgroundColor="$background"
        >
          <ScrollView maxHeight="85vh">
            <YStack gap="$4">
              {/* Header */}
              <XStack alignItems="flex-start" justifyContent="space-between" gap="$4">
                <YStack flex={1} gap="$2">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <Text fontSize="$7" fontWeight="700" color="$color12">
                      {quest.name}
                    </Text>
                    {isDone && (
                      <Text fontSize="$2" color="$green10" backgroundColor="$green3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                        ✓ Completed
                      </Text>
                    )}
                    {isLocked && (
                      <Text fontSize="$2" color="$gray10" backgroundColor="$gray5" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                        🔒 Locked
                      </Text>
                    )}
                    {quest.kappaRequired && (
                      <Text fontSize="$2" color="$purple10" backgroundColor="$purple3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                        Kappa Required
                      </Text>
                    )}
                    {quest.lightkeeperRequired && (
                      <Text fontSize="$2" color="$yellow10" backgroundColor="$yellow3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                        Lightkeeper Required
                      </Text>
                    )}
                  </XStack>

                  <XStack gap="$3" alignItems="center" flexWrap="wrap">
                    {quest.trader && (
                      <YStack gap="$1">
                        <Text fontSize="$1" color="$color10">Trader</Text>
                        <XStack gap="$2" alignItems="center">
                          {quest.trader.image4xLink && (
                            <Card size="$1" bordered overflow="hidden" width={24} height={24}>
                              <img
                                src={quest.trader.image4xLink}
                                alt={quest.trader.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </Card>
                          )}
                          <Text fontSize="$3" fontWeight="600" color="$color12">
                            {quest.trader.name}
                          </Text>
                        </XStack>
                      </YStack>
                    )}
                    {quest.map && (
                      <YStack gap="$1">
                        <Text fontSize="$1" color="$color10">Map</Text>
                        <Text fontSize="$3" fontWeight="600" color="$color12">
                          {quest.map.name}
                        </Text>
                      </YStack>
                    )}
                    {quest.minPlayerLevel && (
                      <YStack gap="$1">
                        <Text fontSize="$1" color="$color10">Min Level</Text>
                        <Text fontSize="$3" fontWeight="600" color={isAvailable ? '$green10' : '$orange10'}>
                          {quest.minPlayerLevel}
                        </Text>
                      </YStack>
                    )}
                    {quest.experience && (
                      <YStack gap="$1">
                        <Text fontSize="$1" color="$color10">Experience</Text>
                        <Text fontSize="$3" fontWeight="600" color="$blue10">
                          +{quest.experience.toLocaleString()} XP
                        </Text>
                      </YStack>
                    )}
                  </XStack>

                  {/* Trader Requirements */}
                  {quest.traderRequirements && quest.traderRequirements.length > 0 && (
                    <XStack gap="$2" flexWrap="wrap">
                      <Text fontSize="$2" color="$color10">Trader Requirements: </Text>
                      {quest.traderRequirements.map((req, idx) => (
                        <Text key={req.trader.id} fontSize="$2" color="$color11">
                          {req.trader.name} Lv.{req.level}
                          {idx < quest.traderRequirements!.length - 1 ? ', ' : ''}
                        </Text>
                      ))}
                    </XStack>
                  )}
                </YStack>

                <Dialog.Close asChild>
                  <Button
                    size="$3"
                    circular
                    icon={X}
                  />
                </Dialog.Close>
              </XStack>

              {/* Quest Image */}
              {quest.taskImageLink && (
                <Card
                  size="$2"
                  bordered
                  overflow="hidden"
                  width="100%"
                  maxHeight={350}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.9 }}
                  onPress={() => quest.wikiLink && window.open(quest.wikiLink, '_blank')}
                >
                  <img
                    src={quest.taskImageLink}
                    alt={quest.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Card>
              )}

              {/* Start Rewards */}
              {quest.startRewards && (
                <Card size="$2" bordered padding="$3" backgroundColor="$blue2">
                  <YStack gap="$2">
                    <XStack gap="$2" alignItems="center">
                      <Award size={16} color="#3b82f6" />
                      <Text fontSize="$4" fontWeight="600" color="$color12">
                        Start Rewards
                      </Text>
                    </XStack>

                    {quest.startRewards.items && quest.startRewards.items.length > 0 && (
                      <YStack gap="$1">
                        <Text fontSize="$2" fontWeight="600" color="$color12">Items:</Text>
                        <XStack gap="$2" flexWrap="wrap">
                          {quest.startRewards.items.map((item, idx) => (
                            <XStack key={idx} gap="$1" alignItems="center" backgroundColor="$background" padding="$1" borderRadius="$2">
                              {item.item.image512pxLink && (
                                <Card size="$1" bordered overflow="hidden" width={24} height={24}>
                                  <img
                                    src={item.item.image512pxLink}
                                    alt={item.item.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </Card>
                              )}
                              <Text fontSize="$2" color="$color11">
                                {item.item.name} x{item.count}
                              </Text>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    )}

                    {quest.startRewards.traderStanding && quest.startRewards.traderStanding.length > 0 && (
                      <YStack gap="$1">
                        {quest.startRewards.traderStanding.map((standing, idx) => (
                          <Text key={idx} fontSize="$2" color="$color11">
                            +{standing.standing} {standing.trader.name} Standing
                          </Text>
                        ))}
                      </YStack>
                    )}
                  </YStack>
                </Card>
              )}

              {/* Requirements */}
              {quest.taskRequirements && quest.taskRequirements.length > 0 && (
                <YStack gap="$2">
                  <Text fontSize="$4" fontWeight="600" color="$color12">
                    Prerequisites:
                  </Text>
                  <YStack gap="$2">
                    {quest.taskRequirements.map((req, index) => {
                      const reqStatus = Array.isArray(req.status) ? req.status[0] : req.status
                      const isCompleted = reqStatus === 'COMPLETED' || reqStatus === 'Success'
                      
                      return (
                        <Card key={index} size="$2" bordered padding="$2" backgroundColor={isCompleted ? '$green2' : '$gray2'}>
                          <XStack gap="$2" alignItems="center">
                            {isCompleted ? (
                              <CheckCircle2 size={18} color="green" />
                            ) : (
                              <Circle size={18} />
                            )}
                            <YStack flex={1}>
                              <Text fontSize="$3" fontWeight="600" color="$color12">
                                {req.task?.name || 'Unknown Quest'}
                              </Text>
                              {req.task?.trader && (
                                <Text fontSize="$2" color="$color10">
                                  {req.task.trader.name}
                                </Text>
                              )}
                            </YStack>
                          </XStack>
                        </Card>
                      )
                    })}
                  </YStack>
                </YStack>
              )}

              {/* Objectives */}
              {quest.objectives && quest.objectives.length > 0 && (
                <YStack gap="$2">
                  <Text fontSize="$4" fontWeight="600" color="$color12">
                    Objectives:
                  </Text>
                  <YStack gap="$2">
                    {quest.objectives.map((objective) => (
                      <Card
                        key={objective.id}
                        size="$2"
                        bordered
                        padding="$3"
                        backgroundColor={objective.optional ? '$blue2' : '$background'}
                      >
                        <YStack gap="$2">
                          <XStack gap="$2" alignItems="center" flexWrap="wrap">
                            {objective.optional && (
                              <Text fontSize="$1" color="$blue10" backgroundColor="$blue3" paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius="$1">
                                Optional
                              </Text>
                            )}
                            <Text fontSize="$3" fontWeight="600" color="$color12">
                              {objective.type}
                            </Text>
                          </XStack>
                          {objective.description && (
                            <Text fontSize="$3" color="$color11">
                              {objective.description}
                            </Text>
                          )}
                          {objective.maps && objective.maps.length > 0 && (
                            <XStack gap="$1" flexWrap="wrap" alignItems="center">
                              <Text fontSize="$2" color="$color10" fontWeight="600">Maps:</Text>
                              {objective.maps.map((map, idx) => (
                                <Text key={map.id} fontSize="$2" color="$color10" backgroundColor="$gray3" paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius="$1">
                                  {map.name}
                                </Text>
                              ))}
                            </XStack>
                          )}
                        </YStack>
                      </Card>
                    ))}
                  </YStack>
                </YStack>
              )}

              {/* Finish Rewards */}
              {quest.finishRewards && (
                <Card size="$2" bordered padding="$3" backgroundColor="$green2">
                  <YStack gap="$2">
                    <XStack gap="$2" alignItems="center">
                      <Award size={16} color="#10b981" />
                      <Text fontSize="$4" fontWeight="600" color="$color12">
                        Completion Rewards
                      </Text>
                    </XStack>
                    
                    {quest.experience && (
                      <XStack gap="$2" alignItems="center">
                        <TrendingUp size={14} />
                        <Text fontSize="$3" color="$green10" fontWeight="600">
                          +{quest.experience.toLocaleString()} XP
                        </Text>
                      </XStack>
                    )}

                    {quest.finishRewards.items && quest.finishRewards.items.length > 0 && (
                      <YStack gap="$2">
                        <Text fontSize="$2" fontWeight="600" color="$color12">Items:</Text>
                        <XStack gap="$2" flexWrap="wrap">
                          {quest.finishRewards.items.map((item, idx) => (
                            <XStack key={idx} gap="$1.5" alignItems="center" backgroundColor="$background" padding="$2" borderRadius="$2">
                              {item.item.image512pxLink && (
                                <Card size="$1" bordered overflow="hidden" width={32} height={32}>
                                  <img
                                    src={item.item.image512pxLink}
                                    alt={item.item.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </Card>
                              )}
                              <YStack>
                                <Text fontSize="$2" fontWeight="600" color="$color12">
                                  {item.item.name}
                                </Text>
                                <Text fontSize="$1" color="$color10">
                                  x{item.count}
                                </Text>
                              </YStack>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    )}

                    {quest.finishRewards.traderStanding && quest.finishRewards.traderStanding.length > 0 && (
                      <YStack gap="$1.5">
                        <Text fontSize="$2" fontWeight="600" color="$color12">Trader Standing:</Text>
                        {quest.finishRewards.traderStanding.map((standing, idx) => (
                          <XStack key={idx} gap="$2" alignItems="center" backgroundColor="$background" padding="$1.5" borderRadius="$2">
                            <Text fontSize="$3" color="$green10" fontWeight="600">
                              +{standing.standing}
                            </Text>
                            <Text fontSize="$2" color="$color12">
                              {standing.trader.name} Standing
                            </Text>
                          </XStack>
                        ))}
                      </YStack>
                    )}
                  </YStack>
                </Card>
              )}

              {/* Failure Outcome */}
              {quest.failureOutcome && (
                <Card size="$2" bordered padding="$3" backgroundColor="$red2">
                  <YStack gap="$2">
                    <XStack gap="$2" alignItems="center">
                      <AlertTriangle size={16} color="#ef4444" />
                      <Text fontSize="$4" fontWeight="600" color="$color12">
                        Failure Penalties
                      </Text>
                    </XStack>
                    
                    {quest.failureOutcome.traderStanding && quest.failureOutcome.traderStanding.length > 0 && (
                      <YStack gap="$1.5">
                        {quest.failureOutcome.traderStanding.map((standing, idx) => (
                          <Text key={idx} fontSize="$2" color="$red10">
                            -{Math.abs(standing.standing)} {standing.trader.name} Standing
                          </Text>
                        ))}
                      </YStack>
                    )}

                    {quest.failureOutcome.items && quest.failureOutcome.items.length > 0 && (
                      <YStack gap="$1.5">
                        <Text fontSize="$2" fontWeight="600" color="$color12">Lost Items:</Text>
                        {quest.failureOutcome.items.map((item, idx) => (
                          <Text key={idx} fontSize="$2" color="$red10">
                            {item.item.name} x{item.count}
                          </Text>
                        ))}
                      </YStack>
                    )}
                  </YStack>
                </Card>
              )}

              {/* Actions */}
              <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
                {quest.wikiLink && (
                  <Button
                    theme="blue"
                    onPress={() => window.open(quest.wikiLink, '_blank')}
                  >
                    <XStack gap="$2" alignItems="center">
                      <ExternalLink size={16} />
                      <Text>Open Wiki</Text>
                    </XStack>
                  </Button>
                )}
                <Button
                  theme={isDone ? 'gray' : 'green'}
                  onPress={onToggleDone}
                  disabled={isLocked}
                >
                  <XStack gap="$2" alignItems="center">
                    {isDone ? (
                      <>
                        <Circle size={16} />
                        <Text>Mark as Incomplete</Text>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <Text>Mark as Complete</Text>
                      </>
                    )}
                  </XStack>
                </Button>
              </XStack>
            </YStack>
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
