/**
 * Wiki scraper utility for Escape from Tarkov Fandom Wiki
 * Uses FandomScraper library (FandomPersonalScraper) to extract quest data
 */

import type { WikiQuestData } from '../types/wiki'
import { FandomPersonalScraper } from 'fandomscraper'
import { JSDOM } from 'jsdom'

// Note: ISchema, TPageFormat, IDataSource, IImage, IQuote are global types
// defined in fandomscraper's globals.d.ts, so we can use them directly

const WIKI_BASE_URL = 'https://escapefromtarkov.fandom.com'

/**
 * Normalize quest name to match wiki URL format
 */
function normalizeQuestName(questName: string): string {
  return questName
    .replace(/['"]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .trim()
}

/**
 * Build wiki URL for a quest
 */
export function getWikiUrlForQuest(questName: string): string {
  const normalized = normalizeQuestName(questName)
  return `${WIKI_BASE_URL}/wiki/${normalized}`
}

/**
 * Extract level requirement from requirements text
 * Example: "Must be level 2 to start this quest." -> 2
 */
function extractLevelFromRequirements(text: string): number | undefined {
  if (!text) return undefined
  
  const levelPatterns = [
    /(?:must be|required|need).*?(?:level|lvl)\s+(\d+)/i,
    /(?:level|lvl)\s+(\d+).*?(?:to start|required|need)/i,
    /(?:minimum|min).*?(?:level|lvl)\s+(\d+)/i,
    /(?:level|lvl)\s+(\d+)/i,
  ]
  
  for (const pattern of levelPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const level = parseInt(match[1], 10)
      if (!isNaN(level) && level > 0) {
        return level
      }
    }
  }
  
  return undefined
}

/**
 * Create FandomPersonalScraper schema for a quest page
 * This schema defines how to extract data from a quest page
 */
function createQuestPageSchema(wikiUrl: string): ISchema {
  return {
    url: wikiUrl,
    pageFormat: {
      selector: 'body', // We're scraping a single page, not a list
      ignore: [],
    },
    dataSource: {
      // Extract previous quests using custom get function
      previousQuests: {
        identifier: 'h2:contains("Related quests"), h3:contains("Related quests")',
        get: function(page: Document): HTMLAnchorElement[] {
          const relatedSection = Array.from(page.querySelectorAll('h2, h3')).find(
            h => h.textContent?.toLowerCase().includes('related quests')
          )
          if (!relatedSection) return []
          
          let current: Element | null = relatedSection.nextElementSibling
          const links: HTMLAnchorElement[] = []
          
          while (current) {
            const heading = Array.from(current.querySelectorAll('h3, h4, dt')).find(
              h => h.textContent?.toLowerCase().includes('previous')
            )
            if (heading) {
              const list = heading.nextElementSibling
              if (list) {
                const anchors = list.querySelectorAll('a[href*="/wiki/"]')
                links.push(...Array.from(anchors) as HTMLAnchorElement[])
                break
              }
            }
            if (current.tagName === 'H2') break
            current = current.nextElementSibling
          }
          
          return links
        },
      },
      // Extract leads to quests using custom get function
      leadsToQuests: {
        identifier: 'h2:contains("Related quests"), h3:contains("Related quests")',
        get: function(page: Document): HTMLAnchorElement[] {
          const relatedSection = Array.from(page.querySelectorAll('h2, h3')).find(
            h => h.textContent?.toLowerCase().includes('related quests')
          )
          if (!relatedSection) return []
          
          let current: Element | null = relatedSection.nextElementSibling
          const links: HTMLAnchorElement[] = []
          
          while (current) {
            const heading = Array.from(current.querySelectorAll('h3, h4, dt')).find(
              h => h.textContent?.toLowerCase().includes('leads to')
            )
            if (heading) {
              const list = heading.nextElementSibling
              if (list) {
                const anchors = list.querySelectorAll('a[href*="/wiki/"]')
                links.push(...Array.from(anchors) as HTMLAnchorElement[])
                break
              }
            }
            if (current.tagName === 'H2') break
            current = current.nextElementSibling
          }
          
          return links
        },
      },
      // Extract requirements text
      requirements: {
        identifier: 'h2:contains("Requirements"), h3:contains("Requirements"), dt:contains("Requirements")',
        get: function(page: Document): string | null {
          const reqHeading = Array.from(page.querySelectorAll('h2, h3, dt')).find(
            h => h.textContent?.toLowerCase().includes('requirements')
          )
          if (!reqHeading) return null
          
          let text = ''
          let current: Element | null = reqHeading.nextElementSibling
          
          while (current) {
            if (current.tagName.match(/^H[2-4]$/)) break
            text += (current.textContent || '') + ' '
            current = current.nextElementSibling
          }
          
          return text.trim() || null
        },
      },
    },
  }
}

/**
 * Extract quest names from anchor elements (used by FandomScraper's data extraction)
 */
function extractQuestNamesFromAnchors(anchors: HTMLAnchorElement[] | NodeListOf<Element> | null): string[] {
  if (!anchors) return []
  
  const questNames: string[] = []
  const anchorArray = Array.isArray(anchors) ? anchors : Array.from(anchors)
  
  anchorArray.forEach(anchor => {
    const href = anchor.getAttribute('href') || ''
    const text = anchor.textContent?.trim() || ''
    
    // Extract quest name from href
    const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
    if (wikiMatch) {
      const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
      if (questName && !questName.includes('Category:') && !questName.includes('File:')) {
        questNames.push(questName)
      }
    } else if (text) {
      questNames.push(text)
    }
  })
  
  return [...new Set(questNames)] // Remove duplicates
}

/**
 * Extract previous quests from wiki page with improved parsing
 * Handles infobox table format and multiple other formats
 */
function extractPreviousQuests(document: Document): string[] {
  const questNames: string[] = []
  
  // Method 1: Look for infobox table with "Related quests" header
  const relatedQuestHeaders = Array.from(document.querySelectorAll('.va-infobox-header, th'))
    .filter(header => header.textContent?.toLowerCase().includes('related quests'))
  
  for (const header of relatedQuestHeaders) {
    // Find the table containing this header
    const infoboxGroup = header.closest('.va-infobox-group') || header.closest('table')
    if (!infoboxGroup) continue
    
    // Look for td elements with "Previous:" text
    const allCells = infoboxGroup.querySelectorAll('td.va-infobox-content, td')
    
    for (const cell of allCells) {
      const cellText = cell.textContent || ''
      
      // Check if this cell contains "Previous:"
      if (cellText.toLowerCase().includes('previous:')) {
        // Extract links from this cell
        const links = cell.querySelectorAll('a[href*="/wiki/"]')
        links.forEach(link => {
          const href = link.getAttribute('href') || ''
          const linkText = link.textContent?.trim() || ''
          const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
          
          if (wikiMatch) {
            const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
            if (questName && !questName.includes('Category:') && !questName.includes('File:') && questName !== '-') {
              questNames.push(questName)
            }
          } else if (linkText && linkText !== '-') {
            questNames.push(linkText)
          }
        })
        
        // Also check for text content after "Previous:" and before "Leads to:" or end
        const textLines = cellText.split(/\n|<br>/i).map(l => l.trim())
        for (const line of textLines) {
          if (line.toLowerCase().includes('previous:')) {
            const afterPrevious = line.substring(line.toLowerCase().indexOf('previous:') + 8).trim()
            // Check if there's text before "Leads to:" or end
            const leadsToIndex = afterPrevious.toLowerCase().indexOf('leads to:')
            const questText = leadsToIndex > 0 
              ? afterPrevious.substring(0, leadsToIndex).trim()
              : afterPrevious.trim()
            
            if (questText && !questText.includes(':') && questText.length > 2 && questText !== '-') {
              // Check if this is already in a link
              const isInLink = Array.from(cell.querySelectorAll('a')).some(a => a.textContent?.trim() === questText)
              if (!isInLink && !questNames.includes(questText)) {
                questNames.push(questText)
              }
            }
          }
        }
      }
    }
  }
  
  // Method 2: Fallback to original method if infobox not found
  if (questNames.length === 0) {
    const relatedSection = Array.from(document.querySelectorAll('h2, h3')).find(
      h => h.textContent?.toLowerCase().includes('related quests')
    )
    
    if (relatedSection) {
      let current: Element | null = relatedSection.nextElementSibling
      
      while (current) {
        if (current.tagName === 'H2') break
        
        const textContent = current.textContent || ''
        const normalizedText = textContent.toLowerCase()
        
        if (normalizedText.includes('previous:')) {
          const parts = textContent.split(/Leads to:/i)
          const previousPart = parts[0]
          
          const links = current.querySelectorAll('a[href*="/wiki/"]')
          links.forEach(link => {
            const href = link.getAttribute('href') || ''
            const linkText = link.textContent?.trim() || ''
            const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
            
            if (wikiMatch) {
              const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
              if (questName && !questName.includes('Category:') && !questName.includes('File:') && questName !== '-') {
                const linkPos = textContent.indexOf(linkText)
                const leadsToPos = textContent.toLowerCase().indexOf('leads to:')
                if (leadsToPos === -1 || linkPos < leadsToPos) {
                  questNames.push(questName)
                }
              }
            }
          })
          
          if (previousPart) {
            const lines = previousPart.split(/\n|\t/).map(l => l.trim())
            lines.forEach(line => {
              if (line.toLowerCase().startsWith('previous')) {
                const afterLabel = line.substring(line.toLowerCase().indexOf('previous') + 8).trim()
                if (afterLabel && !afterLabel.includes(':') && afterLabel.length > 2) {
                  questNames.push(afterLabel)
                }
              } else if (line && !line.includes(':') && line.length > 2 && !line.match(/^[-•*]+$/)) {
                questNames.push(line)
              }
            })
          }
          
          break
        }
        
        current = current.nextElementSibling
      }
    }
  }
  
  return [...new Set(questNames.filter(name => name && name !== '-' && name.length > 2))]
}

/**
 * Helper function to extract value from infobox by label text
 */
function extractInfoboxValue(document: Document, labelText: string): string | undefined {
  // Look for infobox labels - specifically va-infobox-label class
  const allLabels = Array.from(document.querySelectorAll('.va-infobox-label'))
  
  for (const label of allLabels) {
    const labelTextContent = label.textContent?.trim() || ''
    
    // Check if this label exactly matches what we're looking for (case-insensitive)
    if (labelTextContent.toLowerCase() === labelText.toLowerCase()) {
      // Find content cell in the same row
      const row = label.closest('tr')
      if (row) {
        // Look specifically for va-infobox-content class
        const contentCell = row.querySelector('td.va-infobox-content')
        
        if (contentCell) {
          // Try to get link text first (for maps/traders)
          const link = contentCell.querySelector('a[href*="/wiki/"]')
          if (link) {
            const linkText = link.textContent?.trim()
            if (linkText && linkText !== '-') {
              return linkText
            }
          }
          
          // Fallback to plain text
          const text = contentCell.textContent?.trim()
          if (text && text !== '-') {
            // Remove any label text that might be in the content
            const cleanText = text.replace(new RegExp(`^${labelText}:?\\s*`, 'gi'), '').trim()
            if (cleanText && cleanText !== '-') {
              return cleanText
            }
            return text
          }
        }
      }
    }
  }
  
  return undefined
}

/**
 * Extract location (map) from infobox
 */
function extractLocationFromInfobox(document: Document): string | undefined {
  // Find label cell with exactly "Location"
  const labels = Array.from(document.querySelectorAll('.va-infobox-label'))
    .filter(label => label.textContent?.trim() === 'Location')
  
  for (const label of labels) {
    const row = label.closest('tr')
    if (row) {
      const contentCell = row.querySelector('td.va-infobox-content')
      if (contentCell) {
        const link = contentCell.querySelector('a[href*="/wiki/"]')
        if (link) {
          const linkText = link.textContent?.trim()
          if (linkText && linkText !== '-') {
            return linkText
          }
        }
        const text = contentCell.textContent?.trim()
        if (text && text !== '-') {
          return text
        }
      }
    }
  }
  
  return undefined
}

/**
 * Extract trader (Given by) from infobox
 */
function extractTraderFromInfobox(document: Document): string | undefined {
  // Find label cell with exactly "Given by"
  const labels = Array.from(document.querySelectorAll('.va-infobox-label'))
    .filter(label => label.textContent?.trim() === 'Given by')
  
  for (const label of labels) {
    const row = label.closest('tr')
    if (row) {
      const contentCell = row.querySelector('td.va-infobox-content')
      if (contentCell) {
        const link = contentCell.querySelector('a[href*="/wiki/"]')
        if (link) {
          const linkText = link.textContent?.trim()
          if (linkText && linkText !== '-') {
            return linkText
          }
        }
        const text = contentCell.textContent?.trim()
        if (text && text !== '-') {
          return text
        }
      }
    }
  }
  
  return undefined
}

/**
 * Extract Kappa Required status from infobox
 */
function extractKappaRequiredFromInfobox(document: Document): boolean | undefined {
  // Look for infobox label containing "Kappa" or "Required for" with Kappa
  const allLabels = Array.from(document.querySelectorAll('.va-infobox-label, td'))
  
  for (const label of allLabels) {
    const labelText = label.textContent?.toLowerCase() || ''
    
    if (labelText.includes('required for') && labelText.includes('kappa')) {
      const row = label.closest('tr')
      if (row) {
        const cells = Array.from(row.querySelectorAll('td'))
        
        for (const cell of cells) {
          if (cell === label) continue
          if (cell.classList.contains('va-infobox-spacing-h') || 
              cell.classList.contains('va-infobox-spacing-v')) {
            continue
          }
          
          const text = cell.textContent?.toLowerCase().trim() || ''
          // Check for "Yes" (can be in red font or plain text)
          if (text === 'yes' || text.startsWith('yes')) {
            return true
          }
          if (text === 'no' || text.startsWith('no') || text === '-') {
            return false
          }
        }
      }
    }
  }
  
  return undefined
}

/**
 * Extract Lightkeeper Required status from infobox
 */
/**
 * Extract rewards data from wiki page
 * Parses EXP, Reputation, and other rewards (Roubles, items, etc.)
 */
function extractRewards(document: Document): {
  exp?: number
  rep?: Array<{ trader: string; amount: number }>
  other?: string[]
} {
  const result: {
    exp?: number
    rep?: Array<{ trader: string; amount: number }>
    other?: string[]
  } = {
    rep: [],
    other: [],
  }

  // Find "Rewards" heading (h2, h3, or other heading elements)
  const headings = Array.from(document.querySelectorAll('h2, h3, h4, h5, h6, .mw-heading, .section-heading'))
  let rewardsSection: Element | null = null

  for (const heading of headings) {
    const headingText = heading.textContent?.trim() || ''
    if (headingText.toLowerCase() === 'rewards') {
      // Find the next sibling element or parent's next sibling
      let current: Element | null = heading.nextElementSibling
      
      // If no next sibling, try to find content within the same parent
      if (!current) {
        const parent = heading.parentElement
        if (parent) {
          current = parent.nextElementSibling
        }
      }
      
      // Also check for ul/ol lists that might be siblings
      if (!current) {
        let nextSibling = heading.nextElementSibling
        while (nextSibling) {
          if (nextSibling.tagName === 'UL' || nextSibling.tagName === 'OL' || 
              nextSibling.tagName === 'DIV' || nextSibling.tagName === 'P') {
            current = nextSibling
            break
          }
          nextSibling = nextSibling.nextElementSibling
        }
      }
      
      if (current) {
        rewardsSection = current
        break
      }
    }
  }

  // Alternative: Look for table rows with "Rewards" header
  if (!rewardsSection) {
    const tables = document.querySelectorAll('table')
    for (const table of tables) {
      const headers = table.querySelectorAll('th, .va-infobox-header')
      for (const header of headers) {
        const headerText = header.textContent?.trim() || ''
        if (headerText.toLowerCase() === 'rewards') {
          const row = header.closest('tr')
          if (row) {
            rewardsSection = row
            break
          }
        }
      }
      if (rewardsSection) break
    }
  }

  // Alternative: Look for divs or sections that might contain rewards
  if (!rewardsSection) {
    const allElements = document.querySelectorAll('*')
    for (const el of allElements) {
      const text = el.textContent || ''
      if (text.includes('Rewards') && (el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4')) {
        let current: Element | null = el.nextElementSibling
        if (!current) {
          const parent = el.parentElement
          if (parent) {
            current = parent.nextElementSibling
          }
        }
        if (current) {
          rewardsSection = current
          break
        }
      }
    }
  }

  if (!rewardsSection) {
    return result
  }

  // Extract text content from rewards section
  // Get all list items, paragraphs, divs, or table cells within the section
  const rewardElements = rewardsSection.querySelectorAll('li, p, div, td, span')
  const rewardTexts: string[] = []

  for (const el of rewardElements) {
    const text = el.textContent?.trim()
    if (text && text.length > 0 && !text.includes('Rewards')) {
      rewardTexts.push(text)
    }
  }

  // If no elements found, try to get direct text content
  if (rewardTexts.length === 0) {
    const directText = rewardsSection.textContent || ''
    if (directText) {
      // Split by newlines and filter empty lines
      const lines = directText.split('\n').map(t => t.trim()).filter(t => t.length > 0 && !t.toLowerCase().includes('rewards'))
      rewardTexts.push(...lines)
    }
  }

  // Parse each reward line
  for (const rewardText of rewardTexts) {
    const trimmed = rewardText.trim()
    if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'rewards') continue

    // Parse EXP: "+1,750 EXP" or "1,750 EXP" or "+1750 EXP" or "+1,750 EXP" (with comma)
    const expMatch = trimmed.match(/^\+?\s*([\d,]+)\s*EXP$/i)
    if (expMatch) {
      const expValue = parseInt(expMatch[1].replace(/,/g, ''), 10)
      if (!isNaN(expValue)) {
        result.exp = expValue
        continue
      }
    }

    // Parse Reputation: "Prapor Rep +0.01" or "Prapor Rep +0.01" or "Prapor +0.01"
    // Also handle "Prapor Rep +0.01" format
    const repMatch = trimmed.match(/^([A-Za-z\s]+?)\s+Rep\s+([+-]?[\d.]+)$/i) || 
                     trimmed.match(/^([A-Za-z\s]+?)\s+([+-]?[\d.]+)\s*Rep$/i) ||
                     trimmed.match(/^([A-Za-z\s]+?)\s+([+-]?[\d.]+)$/i)
    if (repMatch) {
      const traderName = repMatch[1].trim()
      const repAmount = parseFloat(repMatch[2])
      // Only add if it looks like a reputation entry (has "Rep" or small decimal number)
      if (!isNaN(repAmount) && traderName && (repMatch[0].includes('Rep') || Math.abs(repAmount) < 1)) {
        if (!result.rep) {
          result.rep = []
        }
        result.rep.push({ trader: traderName, amount: repAmount })
        continue
      }
    }

    // Everything else goes to "other" rewards
    if (!result.other) {
      result.other = []
    }
    result.other.push(trimmed)
  }

  // Clean up empty arrays
  if (result.rep && result.rep.length === 0) {
    delete result.rep
  }
  if (result.other && result.other.length === 0) {
    delete result.other
  }

  return result
}

function extractLightkeeperRequiredFromInfobox(document: Document): boolean | undefined {
  // Look for infobox label containing "Lightkeeper" or "Required for" with Lightkeeper
  const allLabels = Array.from(document.querySelectorAll('.va-infobox-label, td'))
  
  for (const label of allLabels) {
    const labelText = label.textContent?.toLowerCase() || ''
    
    if (labelText.includes('required for') && labelText.includes('lightkeeper')) {
      const row = label.closest('tr')
      if (row) {
        const cells = Array.from(row.querySelectorAll('td'))
        
        for (const cell of cells) {
          if (cell === label) continue
          if (cell.classList.contains('va-infobox-spacing-h') || 
              cell.classList.contains('va-infobox-spacing-v')) {
            continue
          }
          
          const text = cell.textContent?.toLowerCase().trim() || ''
          if (text === 'yes' || text.startsWith('yes')) {
            return true
          }
          if (text === 'no' || text.startsWith('no') || text === '-') {
            return false
          }
        }
      }
    }
  }
  
  return undefined
}

/**
 * Extract leads to quests from wiki page with improved parsing
 * Handles infobox table format and multiple other formats
 */
function extractLeadsToQuests(document: Document): string[] {
  const questNames: string[] = []
  
  // Method 1: Look for infobox table with "Related quests" header
  const relatedQuestHeaders = Array.from(document.querySelectorAll('.va-infobox-header, th'))
    .filter(header => header.textContent?.toLowerCase().includes('related quests'))
  
  for (const header of relatedQuestHeaders) {
    // Find the table containing this header
    const infoboxGroup = header.closest('.va-infobox-group') || header.closest('table')
    if (!infoboxGroup) continue
    
    // Look for td elements with "Leads to:" text
    const allCells = infoboxGroup.querySelectorAll('td.va-infobox-content, td')
    
    for (const cell of allCells) {
      const cellText = cell.textContent || ''
      
      // Check if this cell contains "Leads to:" but not "Previous:"
      if (cellText.toLowerCase().includes('leads to:') && !cellText.toLowerCase().includes('previous:')) {
        // Extract links from this cell
        const links = cell.querySelectorAll('a[href*="/wiki/"]')
        links.forEach(link => {
          const href = link.getAttribute('href') || ''
          const linkText = link.textContent?.trim() || ''
          const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
          
          if (wikiMatch) {
            const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
            if (questName && !questName.includes('Category:') && !questName.includes('File:') && questName !== '-') {
              questNames.push(questName)
            }
          } else if (linkText && linkText !== '-') {
            questNames.push(linkText)
          }
        })
        
        // Also check for text content after "Leads to:"
        const textLines = cellText.split(/\n|<br>/i).map(l => l.trim())
        for (const line of textLines) {
          if (line.toLowerCase().includes('leads to:')) {
            const afterLeadsTo = line.substring(line.toLowerCase().indexOf('leads to:') + 9).trim()
            // Check if there's text before "Other choices:" or "Requirement for:" or end
            const otherChoicesIndex = afterLeadsTo.toLowerCase().indexOf('other choices:')
            const requirementIndex = afterLeadsTo.toLowerCase().indexOf('requirement for:')
            const endIndex = otherChoicesIndex > 0 
              ? (requirementIndex > 0 ? Math.min(otherChoicesIndex, requirementIndex) : otherChoicesIndex)
              : (requirementIndex > 0 ? requirementIndex : afterLeadsTo.length)
            
            const questText = afterLeadsTo.substring(0, endIndex).trim()
            
            if (questText && !questText.includes(':') && questText.length > 2 && questText !== '-') {
              // Check if this is already in a link
              const isInLink = Array.from(cell.querySelectorAll('a')).some(a => a.textContent?.trim() === questText)
              if (!isInLink && !questNames.includes(questText)) {
                questNames.push(questText)
              }
            }
          }
        }
      }
    }
  }
  
  // Method 2: Fallback to original method if infobox not found
  if (questNames.length === 0) {
    const relatedSection = Array.from(document.querySelectorAll('h2, h3')).find(
      h => h.textContent?.toLowerCase().includes('related quests')
    )
    
    if (relatedSection) {
      let current: Element | null = relatedSection
      while (current) {
        const text = current.textContent?.toLowerCase() || ''
        if (text.includes('leads to:')) {
          const links = current.querySelectorAll('a[href*="/wiki/"]')
          links.forEach(link => {
            const href = link.getAttribute('href') || ''
            const linkText = link.textContent?.trim() || ''
            const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
            
            if (wikiMatch) {
              const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
              if (questName && !questName.includes('Category:') && !questName.includes('File:') && questName !== '-') {
                questNames.push(questName)
              }
            } else if (linkText && linkText !== '-') {
              questNames.push(linkText)
            }
          })
          
          break
        }
        if (current.tagName === 'H2') break
        current = current.nextElementSibling
      }
    }
  }
  
  return [...new Set(questNames.filter(name => name && name !== '-' && name.length > 2))]
}

/**
 * Extract all quest links from the quest list page
 * Returns an array of quests with their trader information
 */
export async function extractAllQuestsFromListPage(wikiUrl: string = `${WIKI_BASE_URL}/wiki/Quests`): Promise<Array<{ name: string; wikiUrl: string; trader?: string }>> {
  try {
    // Fetch the quest list page
    const response = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    })
    
    if (!response.ok) {
      console.warn(`Failed to fetch quest list page: ${response.status} - ${wikiUrl}`)
      return []
    }
    
    const html = await response.text()
    
    // Parse HTML using JSDOM
    const dom = new JSDOM(html, {
      url: wikiUrl,
      referrer: wikiUrl,
      contentType: 'text/html',
      includeNodeLocations: false,
      storageQuota: 10000000,
    })
    const document = dom.window.document
    
    const quests: Array<{ name: string; wikiUrl: string; trader?: string }> = []
    
    // Find all navbox brick tables
    const navboxBricks = document.querySelectorAll('.va-navbox-brick')
    
    for (const brick of navboxBricks) {
      // Find all rows in this brick
      const rows = brick.querySelectorAll('tr')
      
      for (const row of rows) {
        // Look for trader group cell
        const traderGroupCell = row.querySelector('.va-navbox-group')
        if (!traderGroupCell) continue
        
        const traderLink = traderGroupCell.querySelector('a')
        const traderName = traderLink?.textContent?.trim()
        
        // Skip if this is not a trader (e.g., "Operational Tasks")
        if (!traderName || traderName === 'Quests') continue
        
        // Look for quest links in the same row
        const questCell = row.querySelector('.va-navbox-cell')
        if (!questCell) continue
        
        // Extract all quest links from the cell
        // Links are separated by · (middle dot) or newlines
        const questLinks = questCell.querySelectorAll('a[href*="/wiki/"]')
        
        for (const link of questLinks) {
          const href = link.getAttribute('href') || ''
          const questName = link.textContent?.trim() || ''
          
          // Skip if it's the trader link itself
          if (!questName || href === traderLink?.getAttribute('href')) continue
          
          // Skip operational tasks or other non-quest links
          if (questName.includes('Operational Tasks') || questName === traderName) continue
          
          // Extract quest wiki URL
          const questWikiUrl = href.startsWith('http') ? href : `${WIKI_BASE_URL}${href}`
          
          // Extract quest name from URL if needed (normalize)
          let finalQuestName = questName
          const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
          if (wikiMatch && (!finalQuestName || finalQuestName === '-')) {
            finalQuestName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
          }
          
          // Check if this quest is already added (avoid duplicates)
          const existingIndex = quests.findIndex(q => 
            q.wikiUrl === questWikiUrl || 
            (q.name === finalQuestName && q.trader === traderName)
          )
          
          if (existingIndex === -1 && finalQuestName) {
            quests.push({
              name: finalQuestName,
              wikiUrl: questWikiUrl,
              trader: traderName,
            })
          }
        }
      }
    }
    
    return quests
  } catch (error) {
    console.error(`Error extracting quest list:`, error)
    return []
  }
}

/**
 * Scrape quest data from wiki page using FandomScraper
 */
export async function scrapeQuestFromWiki(
  questName: string,
  questId: string,
  wikiUrl?: string
): Promise<WikiQuestData | null> {
  try {
    const finalWikiUrl = wikiUrl || getWikiUrlForQuest(questName)
    
    // Create FandomPersonalScraper instance with custom schema for this quest page
    const schema = createQuestPageSchema(finalWikiUrl)
    const scraper = new FandomPersonalScraper(schema)
    
    // Fetch the page HTML
    const response = await fetch(finalWikiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    })
    
    if (!response.ok) {
      console.warn(`Failed to fetch wiki page for ${questName}: ${response.status} - ${finalWikiUrl}`)
      return null
    }
    
    const html = await response.text()
    
    // Parse HTML using JSDOM (FandomScraper uses JSDOM internally)
    const dom = new JSDOM(html, {
      url: finalWikiUrl,
      referrer: finalWikiUrl,
      contentType: 'text/html',
      includeNodeLocations: false,
      storageQuota: 10000000,
    })
    const document = dom.window.document
    
    // Use FandomScraper's data extraction approach
      // Extract previous quests - improved parsing
      const previousQuests = extractPreviousQuests(document)
      
      // Extract leads to quests - improved parsing
      const leadsToQuests = extractLeadsToQuests(document)
    
    // Extract requirements
    const requirementsField = schema.dataSource.requirements
    const requirementsText = 
      requirementsField && typeof requirementsField === 'object' && 'get' in requirementsField
        ? ((requirementsField.get as (page: Document) => string | null)(document) || '')
        : ''
    const minPlayerLevel = extractLevelFromRequirements(requirementsText)
    
    // Extract infobox data (Location, Given by, Kappa Required, etc.)
    const location = extractLocationFromInfobox(document)
    const givenBy = extractTraderFromInfobox(document)
    const kappaRequired = extractKappaRequiredFromInfobox(document)
    const lightkeeperRequired = extractLightkeeperRequiredFromInfobox(document)
    
    // Extract rewards data
    const rewards = extractRewards(document)
    
    const result: WikiQuestData = {
      questId,
      questName,
      wikiUrl: finalWikiUrl,
      previousQuests,
      leadsToQuests,
      minPlayerLevel,
      requirements: requirementsText || undefined,
      location,
      givenBy,
      kappaRequired,
      lightkeeperRequired,
      rewardsExp: rewards.exp,
      rewardsRep: rewards.rep,
      rewardsOther: rewards.other,
      lastScraped: new Date(),
    }
    
    return result
  } catch (error) {
    console.error(`Error scraping wiki for quest ${questName}:`, error)
    return null
  }
}

/**
 * Batch scrape multiple quests with rate limiting and detailed logging
 */
export async function scrapeQuestsFromWiki(
  quests: Array<{ id: string; name: string; wikiUrl?: string }>,
  onLog?: (log: { level: 'info' | 'success' | 'warning' | 'error'; message: string; questName?: string; questId?: string; details?: Record<string, unknown> }) => void,
  existingWikiData?: Map<string, { previousQuests?: string[]; leadsToQuests?: string[]; minPlayerLevel?: number }>,
  apiData?: Map<string, { minPlayerLevel?: number; taskRequirements?: Array<{ task: { name: string; id: string } }>; taskRequirementNames?: string[]; trader?: string; fullTask?: any }>
): Promise<WikiQuestData[]> {
  const results: WikiQuestData[] = []
  const delay = 2000 // 2 second delay between requests to be respectful
  
  if (onLog) {
    onLog({
      level: 'info',
      message: `Starting scraping process for ${quests.length} quests using FandomScraper...`,
    })
  }
  
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i]
    
    if (onLog) {
      onLog({
        level: 'info',
        message: `[${i + 1}/${quests.length}] Scraping: ${quest.name}`,
        questName: quest.name,
        questId: quest.id,
      })
    }
    
    const data = await scrapeQuestFromWiki(quest.name, quest.id, quest.wikiUrl)
    
    if (data) {
      // Get API data for comparison
      const apiDataForQuest = apiData?.get(quest.id)
      
      // Check for differences with existing wiki data
      const existing = existingWikiData?.get(quest.id)
      const differences: string[] = []
      const apiComparisons: string[] = []
      
      if (existing) {
        // Compare previous quests
        const existingPrev = new Set(existing.previousQuests || [])
        const newPrev = new Set(data.previousQuests || [])
        if (JSON.stringify([...existingPrev].sort()) !== JSON.stringify([...newPrev].sort())) {
          differences.push(`Previous quests changed: ${existing.previousQuests?.length || 0} -> ${data.previousQuests?.length || 0}`)
        }
        
        // Compare leads to quests
        const existingLeads = new Set(existing.leadsToQuests || [])
        const newLeads = new Set(data.leadsToQuests || [])
        if (JSON.stringify([...existingLeads].sort()) !== JSON.stringify([...newLeads].sort())) {
          differences.push(`Leads to quests changed: ${existing.leadsToQuests?.length || 0} -> ${data.leadsToQuests?.length || 0}`)
        }
        
        // Compare level
        if (existing.minPlayerLevel !== data.minPlayerLevel) {
          differences.push(`Level changed: ${existing.minPlayerLevel || 'N/A'} -> ${data.minPlayerLevel || 'N/A'}`)
        }
      }
      
      // Generate git diff style comparison
      const diffLines: string[] = []
      let hasDifferences = false
      
      if (apiDataForQuest) {
        // Compare level in git diff format
        const apiLevel = apiDataForQuest.minPlayerLevel
        const wikiLevel = data.minPlayerLevel
        
        if (apiLevel !== wikiLevel) {
          hasDifferences = true
          diffLines.push('Level:')
          if (apiLevel) {
            diffLines.push(`- ${apiLevel} (API)`)
          }
          if (wikiLevel) {
            diffLines.push(`+ ${wikiLevel} (Wiki)`)
          }
          if (!apiLevel && !wikiLevel) {
            diffLines.push('  (both empty)')
          }
        } else if (apiLevel && wikiLevel) {
          diffLines.push('Level:')
          diffLines.push(`  ${apiLevel} (matches)`)
        }
        
        // Compare prerequisites in git diff format
        const apiPrereqNames = new Set(apiDataForQuest.taskRequirementNames || [])
        const wikiPrereqNames = new Set(data.previousQuests || [])
        
        const apiOnly = [...apiPrereqNames].filter(x => !wikiPrereqNames.has(x)).sort()
        const wikiOnly = [...wikiPrereqNames].filter(x => !apiPrereqNames.has(x)).sort()
        const common = [...apiPrereqNames].filter(x => wikiPrereqNames.has(x)).sort()
        
        if (apiOnly.length > 0 || wikiOnly.length > 0 || common.length > 0) {
          diffLines.push('Prerequisites:')
          
          // Show API only (removed/missing in wiki)
          apiOnly.forEach(prereq => {
            diffLines.push(`- ${prereq} (API only)`)
            hasDifferences = true
          })
          
          // Show Wiki only (added/new in wiki)
          wikiOnly.forEach(prereq => {
            diffLines.push(`+ ${prereq} (Wiki only)`)
            hasDifferences = true
          })
          
          // Show common (matches)
          if (common.length > 0 && apiOnly.length === 0 && wikiOnly.length === 0) {
            // Only show if perfect match
            diffLines.push(`  ${common.length} prerequisite(s) match`)
          } else if (common.length > 0) {
            // Show common items
            common.slice(0, 5).forEach(prereq => {
              diffLines.push(`  ${prereq} (both)`)
            })
            if (common.length > 5) {
              diffLines.push(`  ... and ${common.length - 5} more matching`)
            }
          }
          
          if (apiPrereqNames.size === 0 && wikiPrereqNames.size === 0) {
            diffLines.push('  (no prerequisites in both)')
          }
        }
        
        // Compare leads to quests (if we have that data in API)
        // Note: API doesn't have "leads to" directly, but we can show wiki data
        if (data.leadsToQuests && data.leadsToQuests.length > 0) {
          diffLines.push('Leads To:')
          data.leadsToQuests.forEach(leadTo => {
            diffLines.push(`+ ${leadTo} (Wiki only)`)
          })
        }
      }
      
      // Log extracted data summary
      const extractedSummary: string[] = []
      if (data.previousQuests && data.previousQuests.length > 0) {
        extractedSummary.push(`${data.previousQuests.length} previous quest(s)`)
      }
      if (data.leadsToQuests && data.leadsToQuests.length > 0) {
        extractedSummary.push(`${data.leadsToQuests.length} leads to quest(s)`)
      }
      if (data.minPlayerLevel) {
        extractedSummary.push(`Level ${data.minPlayerLevel}`)
      }
      
      if (onLog) {
        // Create git diff style message
        let message = ''
        const logLevel = hasDifferences || differences.length > 0 ? 'warning' : 'success'
        
        if (diffLines.length > 0 || hasDifferences) {
          // Build git diff format
          message = `--- API Data\n+++ Wiki Data\n`
          if (diffLines.length > 0) {
            message += diffLines.join('\n')
          }
        } else if (extractedSummary.length > 0) {
          message = `✓ Scraped successfully: ${extractedSummary.join(', ')}`
        } else {
          message = '✓ Scraped successfully (no quest relationships found)'
        }
        
        // Add changes from previous scrape if any
        if (differences.length > 0) {
          if (message.includes('--- API Data')) {
            message += '\n'
          }
          message += `\nPrevious scrape changes:\n${differences.map(d => `  • ${d}`).join('\n')}`
        }
        
        onLog({
          level: logLevel,
          message: message,
          questName: quest.name,
          questId: quest.id,
          details: { 
            diffLines,
            hasDifferences,
            extracted: extractedSummary,
            differences,
            apiLevel: apiDataForQuest?.minPlayerLevel,
            wikiLevel: data.minPlayerLevel,
            apiPrerequisites: apiDataForQuest?.taskRequirementNames || [],
            wikiPrerequisites: data.previousQuests || [],
            apiPrereqCount: apiDataForQuest?.taskRequirementNames?.length || 0,
            wikiPrereqCount: data.previousQuests?.length || 0,
            apiOnly: apiDataForQuest 
              ? [...new Set(apiDataForQuest.taskRequirementNames || [])].filter(x => !data.previousQuests?.includes(x))
              : [],
            wikiOnly: data.previousQuests?.filter(x => !apiDataForQuest?.taskRequirementNames?.includes(x)) || [],
          },
        })
      }
      
      results.push(data)
    } else {
      if (onLog) {
        onLog({
          level: 'error',
          message: `✗ Failed to scrape: ${quest.name}`,
          questName: quest.name,
          questId: quest.id,
        })
      }
    }
    
    // Rate limiting - wait before next request
    if (i < quests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  if (onLog) {
    onLog({
      level: 'info',
      message: `Scraping completed: ${results.length}/${quests.length} quests scraped successfully`,
    })
  }
  
  return results
}
