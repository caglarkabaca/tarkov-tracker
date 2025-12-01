'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { QuestNodeData } from '@/lib/utils/questGraph'
import { Lock } from 'lucide-react'

export const QuestNode = memo((props: NodeProps) => {
  const data = props.data as QuestNodeData
  const { quest, isCompleted, isIsolated, playerLevel = 1, isFromOtherTrader = false } = data
  const traderImage = quest.trader?.image4xLink
  const selected = props.selected
  
  // Check if player level is sufficient
  const requiredLevel = quest.minPlayerLevel || 0
  const hasEnoughLevel = playerLevel >= requiredLevel
  const isLocked = !hasEnoughLevel && !isCompleted

  // Determine card colors - card stays normal color unless completed
  let backgroundColor = '#1f2937'
  let borderColor = '#374151'
  let textColor = '#e5e7eb'
  
  if (isCompleted) {
    // Completed: card is green
    backgroundColor = '#10b981'
    borderColor = '#059669'
    textColor = '#ffffff'
  } else if (isIsolated) {
    // Isolated: blue card
    backgroundColor = '#1e3a8a'
    borderColor = '#3b82f6'
    textColor = '#e0e7ff'
  } else {
    // Normal card (available or locked)
    backgroundColor = '#1f2937'
    borderColor = '#374151'
    textColor = '#e5e7eb'
  }

  // LVL text color
  const levelTextColor = isLocked ? '#dc2626' : hasEnoughLevel ? '#16a34a' : textColor

  return (
    <div
      style={{
        width: 200,
        minHeight: 80,
        padding: '12px',
        borderRadius: '8px',
        backgroundColor,
        border: `2px solid ${isFromOtherTrader ? '#f59e0b' : borderColor}`,
        color: textColor,
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.7 : isFromOtherTrader ? 0.95 : 1,
        boxShadow: selected ? '0 0 0 2px #3b82f6' : isFromOtherTrader ? '0 0 0 1px #f59e0b' : 'none',
        transition: 'all 0.2s',
        position: 'relative',
        ...(isLocked && {
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0, 0, 0, 0.3) 10px,
            rgba(0, 0, 0, 0.3) 20px
          )`,
        }),
      }}
      onMouseEnter={(e) => {
        if (!isLocked) {
          e.currentTarget.style.opacity = '0.9'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = isLocked ? '0.7' : '1'
      }}
    >
      {/* Input handles for incoming edges */}
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', zIndex: 1 }}>
        {/* Header with trader image and quest name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {traderImage && (
            <img
              src={traderImage}
              alt={quest.trader?.name || 'Trader'}
              style={{
                width: 20,
                height: 20,
                borderRadius: '4px',
                objectFit: 'cover',
              }}
            />
          )}
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {quest.name.length > 25 ? quest.name.substring(0, 22) + '...' : quest.name}
          </div>
          {isCompleted && (
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✓</span>
          )}
          {isLocked && (
            <Lock size={14} style={{ flexShrink: 0, color: '#dc2626' }} />
          )}
        </div>

        {/* Level and Experience */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '10px',
          opacity: 0.9,
          fontWeight: 600,
        }}>
          {requiredLevel > 0 && (
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 'bold',
              color: levelTextColor,
            }}>
              LVL {requiredLevel}
            </span>
          )}
          {quest.experience && (
            <span style={{ fontSize: '9px' }}>
              +{quest.experience.toLocaleString()} XP
            </span>
          )}
        </div>
      </div>

      {/* Output handles for outgoing edges */}
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  )
})

QuestNode.displayName = 'QuestNode'
