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
 * Extract quest names from Requirements section that use "Accept <quest_name>" format
 * Also extracts quest names mentioned in requirements text with links
 */
function extractQuestsFromRequirements(document: Document, requirementsText: string): string[] {
  const questNames: string[] = []
  
  if (!requirementsText) return questNames
  
  // Pattern 1: "Accept <quest_name>" or "Accept the quest <quest_name>"
  const acceptPatterns = [
    /accept\s+(?:the\s+quest\s+)?(?:<[^>]+>)?([A-Z][a-zA-Z\s\-\']+(?:\s+[A-Z][a-zA-Z\s\-\']+)*)/gi,
    /accept\s+([A-Z][a-zA-Z\s\-\']+(?:\s+[A-Z][a-zA-Z\s\-\']+)*)/gi,
    /must\s+accept\s+(?:the\s+quest\s+)?([A-Z][a-zA-Z\s\-\']+(?:\s+[A-Z][a-zA-Z\s\-\']+)*)/gi,
    /complete\s+(?:the\s+quest\s+)?([A-Z][a-zA-Z\s\-\']+(?:\s+[A-Z][a-zA-Z\s\-\']+)*)/gi,
  ]
  
  for (const pattern of acceptPatterns) {
    const matches = requirementsText.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        const questName = match[1].trim()
        // Filter out common false positives
        if (questName.length > 3 && 
            !questName.toLowerCase().includes('level') &&
            !questName.toLowerCase().includes('reputation') &&
            !questName.toLowerCase().includes('standing') &&
            !questName.match(/^\d+$/)) {
          questNames.push(questName)
        }
      }
    }
  }
  
  // Pattern 2: Extract quest links from Requirements section
  const reqHeading = Array.from(document.querySelectorAll('h2, h3, dt')).find(
    h => h.textContent?.toLowerCase().includes('requirements')
  )
  
  if (reqHeading) {
    let current: Element | null = reqHeading.nextElementSibling
    
    while (current) {
      if (current.tagName.match(/^H[2-4]$/)) break
      
      // Find quest links in requirements section
      const links = current.querySelectorAll('a[href*="/wiki/"]')
      links.forEach(link => {
        const href = link.getAttribute('href') || ''
        const linkText = link.textContent?.trim() || ''
        const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
        
        if (wikiMatch) {
          const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
          if (questName && 
              !questName.includes('Category:') && 
              !questName.includes('File:') && 
              !questName.includes('User:') &&
              questName !== '-' &&
              questName.length > 2) {
            questNames.push(questName)
          }
        } else if (linkText && 
                   linkText.length > 2 && 
                   !linkText.toLowerCase().includes('category') &&
                   !linkText.toLowerCase().includes('file')) {
          questNames.push(linkText)
        }
      })
      
      current = current.nextElementSibling
    }
  }
  
  return [...new Set(questNames.filter(name => name && name.trim().length > 2))]
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
 * Extract previous quest links from wiki page
 * Returns array of { name, wikiUrl } objects for more reliable matching
 */
function extractPreviousQuestLinks(document: Document, baseUrl: string = WIKI_BASE_URL): Array<{ name: string; wikiUrl: string }> {
  const questLinks: Array<{ name: string; wikiUrl: string }> = []
  
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
          
          // Skip if link is in "Leads to:" section
          const cellTextLower = cellText.toLowerCase()
          const linkPos = cellText.indexOf(linkText)
          const leadsToPos = cellTextLower.indexOf('leads to:')
          if (leadsToPos !== -1 && linkPos > leadsToPos) {
            return // Skip this link, it's in "Leads to:" section
          }
          
          // Parse relative URL
          if (href.startsWith('/wiki/')) {
            const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
            if (wikiMatch) {
              const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
              if (questName && 
                  !questName.includes('Category:') && 
                  !questName.includes('File:') && 
                  !questName.includes('User:') &&
                  questName !== '-') {
                // Build full URL
                const fullUrl = baseUrl + href.split('?')[0] // Remove query params
                questLinks.push({
                  name: linkText || questName,
                  wikiUrl: fullUrl,
                })
              }
            }
          } else if (href.startsWith('http')) {
            // Already a full URL
            const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
            if (wikiMatch) {
              const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
              if (questName && 
                  !questName.includes('Category:') && 
                  !questName.includes('File:') && 
                  !questName.includes('User:') &&
                  questName !== '-') {
                questLinks.push({
                  name: linkText || questName,
                  wikiUrl: href.split('?')[0], // Remove query params
                })
              }
            }
          }
        })
      }
    }
  }
  
  // Method 2: Fallback to original method if infobox not found
  if (questLinks.length === 0) {
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
          const links = current.querySelectorAll('a[href*="/wiki/"]')
          links.forEach(link => {
            const href = link.getAttribute('href') || ''
            const linkText = link.textContent?.trim() || ''
            const linkPos = textContent.indexOf(linkText)
            const leadsToPos = textContent.toLowerCase().indexOf('leads to:')
            
            // Skip if link is in "Leads to:" section
            if (leadsToPos !== -1 && linkPos > leadsToPos) {
              return
            }
            
            if (href.startsWith('/wiki/')) {
              const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
              if (wikiMatch) {
                const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
                if (questName && 
                    !questName.includes('Category:') && 
                    !questName.includes('File:') && 
                    questName !== '-') {
                  const fullUrl = baseUrl + href.split('?')[0]
                  questLinks.push({
                    name: linkText || questName,
                    wikiUrl: fullUrl,
                  })
                }
              }
            } else if (href.startsWith('http')) {
              const wikiMatch = href.match(/\/wiki\/(.+?)(?:\?|$)/)
              if (wikiMatch) {
                const questName = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
                if (questName && 
                    !questName.includes('Category:') && 
                    !questName.includes('File:') && 
                    questName !== '-') {
                  questLinks.push({
                    name: linkText || questName,
                    wikiUrl: href.split('?')[0],
                  })
                }
              }
            }
          })
          
          break
        }
        
        current = current.nextElementSibling
      }
    }
  }
  
  // Remove duplicates based on wikiUrl
  const seen = new Set<string>()
  return questLinks.filter(link => {
    if (seen.has(link.wikiUrl)) {
      return false
    }
    seen.add(link.wikiUrl)
    return link.name && link.name.length > 2 && link.name !== '-'
  })
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
 * Extract quest image from infobox mainimage
 * Returns URL in format: https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/.../revision/latest?cb=...
 */
function extractQuestImage(document: Document): string | undefined {
  try {
    // Look for infobox mainimage container
    const mainImageContainer = document.querySelector('.va-infobox-mainimage')
    if (!mainImageContainer) return undefined
    
    // Find the img tag within the mainimage container
    const imgElement = mainImageContainer.querySelector('img')
    if (!imgElement) return undefined
    
    // Try to get the full image URL from various attributes (prioritize data-src as it's usually the full URL)
    let imageSrc = imgElement.getAttribute('data-src') ||
                   imgElement.getAttribute('src') ||
                   imgElement.getAttribute('data-original-src')
    
    if (!imageSrc) {
      return undefined
    }
    
    // Normalize the URL to the format: https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/.../revision/latest?cb=...
    
    // If it's already in the correct format, return as is
    if (imageSrc.includes('static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/')) {
      // Ensure it has /revision/latest
      if (!imageSrc.includes('/revision/latest')) {
        // Extract the base path and query params
        const urlParts = imageSrc.split('?')
        const basePath = urlParts[0]
        const queryParams = urlParts[1] || ''
        
        // Add /revision/latest before query params
        return `${basePath}/revision/latest${queryParams ? '?' + queryParams : ''}`
      }
      return imageSrc
    }
    
    // If it's a relative URL starting with /wiki/images/
    if (imageSrc.includes('/wiki/images/') || imageSrc.includes('/images/')) {
      // Extract the image path
      let imagePath = ''
      if (imageSrc.includes('/wiki/images/')) {
        imagePath = imageSrc.split('/wiki/images/')[1]?.split('?')[0] || ''
      } else if (imageSrc.includes('/images/')) {
        imagePath = imageSrc.split('/images/')[1]?.split('?')[0] || ''
      }
      
      if (imagePath) {
        // Remove /revision/latest if present
        imagePath = imagePath.replace(/\/revision\/latest\/?$/, '').replace(/\/revision\/latest\//, '/')
        
        // Extract query params if any
        const urlParts = imageSrc.split('?')
        const queryParams = urlParts[1] || ''
        
        return `https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/${imagePath}/revision/latest${queryParams ? '?' + queryParams : ''}`
      }
    }
    
    // If it's a data-image-key or data-image-name, construct URL
    const imageKey = imgElement.getAttribute('data-image-key') || imgElement.getAttribute('data-image-name')
    if (imageKey && !imageSrc.includes('http')) {
      // Construct URL from image key
      // Format: /images/[first char]/[first 2 chars]/[filename]
      const firstChar = imageKey.charAt(0).toLowerCase()
      const secondChar = imageKey.length > 1 ? imageKey.substring(0, 2).toLowerCase() : firstChar
      return `https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/${firstChar}/${secondChar}/${imageKey}/revision/latest`
    }
    
    // If it's already an absolute HTTP(S) URL but not in the right format, try to convert
    if (imageSrc.startsWith('http')) {
      // If it's from wikia/fandom, try to extract the image path
      const wikiaMatch = imageSrc.match(/\/images\/(.+?)(?:\?|$|\/revision)/)
      if (wikiaMatch) {
        const imagePath = wikiaMatch[1]
        const queryMatch = imageSrc.match(/\?(.+)$/)
        const queryParams = queryMatch ? queryMatch[1] : ''
        
        // Remove /revision/latest if present in path
        const cleanPath = imagePath.replace(/\/revision\/latest\/?$/, '')
        
        return `https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/${cleanPath}/revision/latest${queryParams ? '?' + queryParams : ''}`
      }
      
      // Return as is if we can't convert it
      return imageSrc
    }
    
    // If relative URL, make it absolute
    if (imageSrc.startsWith('/')) {
      // Check if it contains image path
      if (imageSrc.includes('/images/')) {
        const match = imageSrc.match(/\/images\/(.+)/)
        if (match) {
          const imagePath = match[1].split('?')[0]
          const queryParams = imageSrc.includes('?') ? imageSrc.split('?')[1] : ''
          return `https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/${imagePath}/revision/latest${queryParams ? '?' + queryParams : ''}`
        }
      }
      return `https://escapefromtarkov.fandom.com${imageSrc}`
    }
    
    // If protocol-relative, add https
    if (imageSrc.startsWith('//')) {
      return `https:${imageSrc}`
    }
    
    return undefined
  } catch (error) {
    console.error('Error extracting quest image:', error)
    return undefined
  }
}

/**
 * Extract Objectives from wiki page
 * Looks for "Objectives" heading and extracts objective items below it
 * This section is distinct from "Guide" and contains the quest objectives/tasks
 */
function extractObjectives(document: Document): Array<{
  id: string
  type: string
  description?: string
  optional?: boolean
  maps?: string[]
}> | undefined {
  try {
    const objectives: Array<{
      id: string
      type: string
      description?: string
      optional?: boolean
      maps?: string[]
    }> = []
    
    // Find all headings that contain "Objectives" (case-insensitive, but not "Requirements" or "Guide")
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, .mw-heading'))
    
    for (const heading of headings) {
      const headingText = heading.textContent?.trim() || ''
      const normalizedHeading = headingText.toLowerCase()
      
      // Check if this heading is exactly "Objectives" or contains it (but not "Requirements" or "Guide")
      if (normalizedHeading === 'objectives' || 
          (normalizedHeading.includes('objectives') && 
           !normalizedHeading.includes('requirement') && 
           !normalizedHeading.includes('guide'))) {
        
        // Find the section starting from this heading
        let currentElement: Element | null = heading.nextElementSibling
        const currentHeadingLevel = heading.tagName.match(/^H(\d)$/) 
          ? parseInt(heading.tagName[1]) 
          : 3 // Default to h3 if not a standard heading
        let objectiveIndex = 0
        let foundContent = false
        
        // Traverse siblings until we hit another heading of same or higher level, or find "Guide" section
        while (currentElement) {
          const tagName = currentElement.tagName.toUpperCase()
          
          // Stop if we hit another heading
          if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
            const headingLevel = parseInt(tagName[1])
            // If same or higher level heading, we've reached the end of this section
            if (headingLevel <= currentHeadingLevel) {
              const nextHeadingText = currentElement.textContent?.trim().toLowerCase() || ''
              // Stop if next section is "Guide"
              if (nextHeadingText.includes('guide') && !nextHeadingText.includes('objectives')) {
                break
              }
              // Stop at same/higher level headings
              if (headingLevel <= currentHeadingLevel) {
                break
              }
            }
          }
          
          // Look for list items (ul, ol)
          if (tagName === 'UL' || tagName === 'OL') {
            const listItems = currentElement.querySelectorAll('li')
            for (const item of listItems) {
              const text = item.textContent?.trim()
              if (text && text.length > 0 && text !== '-') {
                foundContent = true
                
                // Check if it's optional
                const isOptional = text.toLowerCase().includes('(optional)') || 
                                 text.toLowerCase().includes('[optional]') ||
                                 text.toLowerCase().includes('optional:')
                
                // Extract maps from text
                const maps: string[] = []
                const mapNames = ['Ground Zero', 'Streets', 'Woods', 'Factory', 'Interchange', 
                                 'Customs', 'Reserve', 'Lighthouse', 'Shoreline', 'Lab', 'The Lab']
                for (const mapName of mapNames) {
                  if (text.includes(mapName)) {
                    maps.push(mapName)
                  }
                }
                
                // Clean the text (remove optional markers)
                let cleanText = text
                  .replace(/\(optional\)/gi, '')
                  .replace(/\[optional\]/gi, '')
                  .replace(/optional:/gi, '')
                  .trim()
                
                // Extract type and description
                let type = 'Objective'
                let description = cleanText
                
                // Try to extract type from patterns like "Type: Description" or "Type. Description"
                const colonMatch = cleanText.match(/^([^:]+):\s*(.+)$/)
                if (colonMatch) {
                  type = colonMatch[1].trim()
                  description = colonMatch[2].trim()
                } else {
                  const dotMatch = cleanText.match(/^([^.]+)\.\s+(.+)$/)
                  if (dotMatch && dotMatch[1].length < 50) {
                    type = dotMatch[1].trim()
                    description = dotMatch[2].trim()
                  }
                }
                
                objectives.push({
                  id: `obj-${objectiveIndex++}`,
                  type: type || 'Objective',
                  description: description || cleanText,
                  optional: isOptional,
                  maps: maps.length > 0 ? maps : undefined,
                })
              }
            }
          } else if (tagName === 'DIV' || tagName === 'P') {
            // Check if div/paragraph contains a list
            const nestedList = currentElement.querySelector('ul, ol')
            if (nestedList) {
              const listItems = nestedList.querySelectorAll('li')
              for (const item of listItems) {
                const text = item.textContent?.trim()
                if (text && text.length > 0 && text !== '-') {
                  foundContent = true
                  
                  const isOptional = text.toLowerCase().includes('(optional)') || 
                                   text.toLowerCase().includes('[optional]') ||
                                   text.toLowerCase().includes('optional:')
                  
                  const maps: string[] = []
                  const mapNames = ['Ground Zero', 'Streets', 'Woods', 'Factory', 'Interchange', 
                                   'Customs', 'Reserve', 'Lighthouse', 'Shoreline', 'Lab', 'The Lab']
                  for (const mapName of mapNames) {
                    if (text.includes(mapName)) {
                      maps.push(mapName)
                    }
                  }
                  
                  let cleanText = text
                    .replace(/\(optional\)/gi, '')
                    .replace(/\[optional\]/gi, '')
                    .replace(/optional:/gi, '')
                    .trim()
                  
                  let type = 'Objective'
                  let description = cleanText
                  
                  const colonMatch = cleanText.match(/^([^:]+):\s*(.+)$/)
                  if (colonMatch) {
                    type = colonMatch[1].trim()
                    description = colonMatch[2].trim()
                  } else {
                    const dotMatch = cleanText.match(/^([^.]+)\.\s+(.+)$/)
                    if (dotMatch && dotMatch[1].length < 50) {
                      type = dotMatch[1].trim()
                      description = dotMatch[2].trim()
                    }
                  }
                  
                  objectives.push({
                    id: `obj-${objectiveIndex++}`,
                    type: type || 'Objective',
                    description: description || cleanText,
                    optional: isOptional,
                    maps: maps.length > 0 ? maps : undefined,
                  })
                }
              }
            } else {
              // Check if it's a plain text objective (numbered or bulleted in paragraph)
              const text = currentElement.textContent?.trim()
              if (text && text.length > 5 && 
                  (text.match(/^\d+[\.\)]\s/) || text.match(/^[•\-\*]\s/) || text.match(/^[●○]\s/))) {
                foundContent = true
                
                const isOptional = text.toLowerCase().includes('(optional)') || 
                                 text.toLowerCase().includes('[optional]')
                
                let cleanText = text
                  .replace(/^\d+[\.\)]\s+/, '')
                  .replace(/^[•\-\*●○]\s+/, '')
                  .replace(/\(optional\)/gi, '')
                  .replace(/\[optional\]/gi, '')
                  .trim()
                
                objectives.push({
                  id: `obj-${objectiveIndex++}`,
                  type: cleanText.split(':')[0]?.trim() || 'Objective',
                  description: cleanText,
                  optional: isOptional,
                  maps: undefined,
                })
              }
            }
          }
          
          currentElement = currentElement.nextElementSibling
        }
        
        // If we found objectives, return them
        if (objectives.length > 0 || foundContent) {
          return objectives.length > 0 ? objectives : undefined
        }
      }
    }
    
    return undefined
  } catch (error) {
    console.error('Error extracting objectives:', error)
    return undefined
  }
}

/**
 * Extract Guide section steps/items from wiki page
 * Looks for "Guide" heading and extracts list items below it
 * This section is distinct from "Objectives" and contains tips/how-to information
 */
function extractGuideSteps(document: Document): string[] | undefined {
  try {
    const guideSteps: string[] = []
    
    // Find all headings that contain "Guide" (case-insensitive, but not "Walkthrough" or "Objectives")
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, .mw-heading'))
    
    for (const heading of headings) {
      const headingText = heading.textContent?.trim() || ''
      const normalizedHeading = headingText.toLowerCase()
      
      // Check if this heading is exactly "Guide" or contains "Guide" (but not "Walkthrough" or "Objectives")
      if (normalizedHeading === 'guide' || 
          (normalizedHeading.includes('guide') && 
           !normalizedHeading.includes('walkthrough') &&
           !normalizedHeading.includes('objectives'))) {
        
        // Find the section starting from this heading
        let currentElement: Element | null = heading.nextElementSibling
        const currentHeadingLevel = heading.tagName.match(/^H(\d)$/) 
          ? parseInt(heading.tagName[1]) 
          : 3 // Default to h3 if not a standard heading
        let foundContent = false
        
        // Traverse siblings until we hit another heading of same or higher level
        while (currentElement) {
          const tagName = currentElement.tagName.toUpperCase()
          
          // Stop if we hit another heading of same or higher level
          if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
            const headingLevel = parseInt(tagName[1])
            if (headingLevel <= currentHeadingLevel) {
              break
            }
          }
          
          // Look for lists (ul, ol)
          if (tagName === 'UL' || tagName === 'OL') {
            const listItems = currentElement.querySelectorAll('li')
            for (const item of listItems) {
              const text = item.textContent?.trim()
              if (text && text.length > 0 && text !== '-') {
                foundContent = true
                guideSteps.push(text)
              }
            }
            // If we found a list with items, continue (there might be multiple lists or paragraphs)
          } else if (tagName === 'DIV' || tagName === 'P') {
            // Check if this div/paragraph contains a navbox - if so, stop processing
            const elementClass = (currentElement as HTMLElement).className || ''
            const hasNavbox = elementClass.includes('navbox') || 
                             elementClass.includes('va-navbox') ||
                             currentElement.querySelector('.navbox, .va-navbox, table.navbox, table.va-navbox')
            
            if (hasNavbox) {
              // This contains a navigation box, stop processing guide steps
              break
            }
            
            // Check if it contains a list
            const nestedList = currentElement.querySelector('ul, ol')
            if (nestedList) {
              const listItems = nestedList.querySelectorAll('li')
              for (const item of listItems) {
                const text = item.textContent?.trim()
                if (text && text.length > 0 && text !== '-') {
                  foundContent = true
                  guideSteps.push(text)
                }
              }
            } else {
              // Check if it's a numbered step, bullet point, or informative paragraph
              const text = currentElement.textContent?.trim()
              if (text && text.length > 5) {
                // Check for numbered/bulleted format
                if (text.match(/^\d+[\.\)]\s/) || 
                    text.match(/^[•\-\*]\s/) || 
                    text.match(/^[●○]\s/) ||
                    // Or if it's a substantial paragraph (guide content)
                    (text.length > 20 && !text.toLowerCase().includes('objectives'))) {
                  foundContent = true
                  // Clean up numbered/bulleted prefixes
                  const cleanText = text
                    .replace(/^\d+[\.\)]\s+/, '')
                    .replace(/^[•\-\*●○]\s+/, '')
                    .trim()
                  if (cleanText.length > 0) {
                    guideSteps.push(cleanText)
                  }
                }
              }
            }
          } else if (tagName === 'TABLE') {
            // Check if this is a navbox table - if so, stop processing (we've reached navigation/content box)
            const tableElement = currentElement as HTMLTableElement
            const tableClass = tableElement.className || ''
            if (tableClass.includes('navbox') || 
                tableClass.includes('va-navbox') ||
                tableElement.classList.contains('navbox') ||
                tableElement.querySelector('.navbox, .va-navbox')) {
              // This is a navigation box, stop processing guide steps
              break
            }
            
            // Sometimes guides have tables with tips/instructions (but not navboxes)
            const rows = currentElement.querySelectorAll('tr')
            for (const row of rows) {
              const cells = row.querySelectorAll('td')
              if (cells.length > 0) {
                const text = Array.from(cells)
                  .map(cell => cell.textContent?.trim())
                  .filter(t => t && t.length > 0)
                  .join(' - ')
                if (text && text.length > 10) {
                  foundContent = true
                  guideSteps.push(text)
                }
              }
            }
          }
          
          currentElement = currentElement.nextElementSibling
        }
        
        // If we found guide steps, return them
        if (guideSteps.length > 0 || foundContent) {
          return guideSteps.length > 0 ? guideSteps : undefined
        }
      }
    }
    
    return undefined
  } catch (error) {
    console.error('Error extracting guide steps:', error)
    return undefined
  }
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
 * Optionally uses raw HTML from MongoDB if available
 */
export async function scrapeQuestFromWiki(
  questName: string,
  questId: string,
  wikiUrl?: string,
  /**
   * When true, try to load HTML from raw_wiki_quests first
   * to avoid hitting the wiki for every quest.
   */
  useRawHtml: boolean = false
): Promise<WikiQuestData | null> {
  try {
    const finalWikiUrl = wikiUrl || getWikiUrlForQuest(questName)
    
    // Create FandomPersonalScraper instance with custom schema for this quest page
    const schema = createQuestPageSchema(finalWikiUrl)
    const scraper = new FandomPersonalScraper(schema)
    
    let html: string | null = null
    
    // Try to use raw HTML from MongoDB if requested
    if (useRawHtml) {
      try {
        const { getRawWikiQuest, updateLastScrapedAt } = await import('../db/rawWikiQuests')
        const rawQuest = await getRawWikiQuest(questId)
        if (rawQuest && rawQuest.rawHtml) {
          html = rawQuest.rawHtml
          // Mark this raw page as used for scraping
          await updateLastScrapedAt(questId)
        }
      } catch (error) {
        console.warn(`Failed to get raw HTML for ${questName}, falling back to fetch:`, error)
      }
    }
    
    // Fetch from wiki if raw HTML not available
    if (!html) {
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
      
      html = await response.text()
    }
    
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
      
      // Extract previous quest links (more reliable for matching)
      const previousQuestLinks = extractPreviousQuestLinks(document, WIKI_BASE_URL)
      
      // Extract leads to quests - improved parsing
      const leadsToQuests = extractLeadsToQuests(document)
    
    // Extract requirements
    const requirementsField = schema.dataSource.requirements
    const requirementsText = 
      requirementsField && typeof requirementsField === 'object' && 'get' in requirementsField
        ? ((requirementsField.get as (page: Document) => string | null)(document) || '')
        : ''
    const minPlayerLevel = extractLevelFromRequirements(requirementsText)
    
    // Extract quest names from Requirements section (e.g., "Accept <quest_name>")
    const questsFromRequirements = extractQuestsFromRequirements(document, requirementsText)
    
    // Merge previousQuests with quests from Requirements section
    const allPreviousQuests = [...new Set([...previousQuests, ...questsFromRequirements])]
    
    // Extract infobox data (Location, Given by, Kappa Required, etc.)
    const location = extractLocationFromInfobox(document)
    const givenBy = extractTraderFromInfobox(document)
    const kappaRequired = extractKappaRequiredFromInfobox(document)
    const lightkeeperRequired = extractLightkeeperRequiredFromInfobox(document)
    
    // Extract quest image from infobox
    const questImage = extractQuestImage(document)
    
    // Extract rewards data
    const rewards = extractRewards(document)
    
    // Extract Objectives
    const objectives = extractObjectives(document)
    
    // Extract Guide section steps
    const guideSteps = extractGuideSteps(document)
    
    const result: WikiQuestData = {
      questId,
      questName,
      wikiUrl: finalWikiUrl,
      previousQuests: allPreviousQuests.length > 0 ? allPreviousQuests : undefined,
      previousQuestLinks: previousQuestLinks.length > 0 ? previousQuestLinks : undefined,
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
      questImage,
      objectives,
      guideSteps,
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
  apiData?: Map<string, { minPlayerLevel?: number; taskRequirements?: Array<{ task: { name: string; id: string } }>; taskRequirementNames?: string[]; trader?: string; fullTask?: any }>,
  /**
   * When true, prefer HTML from raw_wiki_quests for all quests.
   */
  useRawHtml: boolean = false
): Promise<WikiQuestData[]> {
  const results: WikiQuestData[] = []
  // If we are using cached raw HTML, we can run with no delay and parallelize
  const delay = useRawHtml ? 0 : 2000
  
  if (onLog) {
    onLog({
      level: 'info',
      message: `Starting scraping process for ${quests.length} quests using FandomScraper...`,
    })
  }
  
  const processOne = async (i: number) => {
    const quest = quests[i]
    
    if (onLog) {
      onLog({
        level: 'info',
        message: `[${i + 1}/${quests.length}] Scraping: ${quest.name}`,
        questName: quest.name,
        questId: quest.id,
      })
    }
    
    // Prefer raw HTML from raw_wiki_quests if requested, otherwise hit wiki directly
    const data = await scrapeQuestFromWiki(quest.name, quest.id, quest.wikiUrl, useRawHtml)
    
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
    
    // Rate limiting - wait before next request when we are hitting live wiki
    if (!useRawHtml && i < quests.length - 1 && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  if (useRawHtml) {
    // Parallel processing with limited concurrency when using cached HTML
    const concurrency = Math.min(8, quests.length || 1)
    let currentIndex = 0

    const workers = Array.from({ length: concurrency }, async () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const i = currentIndex++
        if (i >= quests.length) break
        await processOne(i)
      }
    })

    await Promise.all(workers)
  } else {
    // Sequential when we might be hitting the live wiki
    for (let i = 0; i < quests.length; i++) {
      await processOne(i)
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
