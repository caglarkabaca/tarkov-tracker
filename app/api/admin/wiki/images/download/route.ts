import { NextRequest, NextResponse } from 'next/server'
import { findUserById } from '@/lib/db/user'
import { getCachedWikiQuestTasks } from '@/lib/db/wikiQuests'
import { saveWikiImage, getWikiImage } from '@/lib/db/wikiImages'

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${contentType};base64,${base64}`

    return {
      base64: dataUri, // Store as data URI for easy use
      mimeType: contentType,
    }
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error)
    return null
  }
}

/**
 * POST /api/admin/wiki/images/download
 * Download all quest images from wiki_quests and save as base64
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await findUserById(userId)
    
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get all quests from wiki_quests
    const quests = await getCachedWikiQuestTasks()

    if (!quests || quests.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No quests found. Please scrape quest data first.',
      })
    }

    // Collect all unique image URLs
    const imageUrls = new Set<string>()
    quests.forEach((quest) => {
      if (quest.taskImageLink && quest.taskImageLink.startsWith('http')) {
        imageUrls.add(quest.taskImageLink)
      }
    })

    const urlsArray = Array.from(imageUrls)
    
    if (urlsArray.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No image URLs found in quests.',
        downloaded: 0,
        total: 0,
      })
    }

    // Download and save images
    let downloaded = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < urlsArray.length; i++) {
      const url = urlsArray[i]
      
      // Check if already downloaded
      const existing = await getWikiImage(url)
      if (existing) {
        downloaded++
        continue
      }

      try {
        const imageData = await downloadImageAsBase64(url)
        
        if (imageData) {
          await saveWikiImage(url, imageData.base64, imageData.mimeType)
          downloaded++
        } else {
          failed++
          errors.push(`Failed to download: ${url}`)
        }

        // Add small delay to avoid rate limiting
        if (i < urlsArray.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        failed++
        errors.push(`Error processing ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Downloaded ${downloaded} images, ${failed} failed`,
      downloaded,
      failed,
      total: urlsArray.length,
      errors: errors.slice(0, 10), // Limit error messages
    })
  } catch (error) {
    console.error('Error in download images route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

