/**
 * MongoDB functions for storing wiki quest images as base64
 */

import { getDatabase } from '../mongodb'

const COLLECTION_NAME = 'wiki_images'

export interface WikiImageDocument {
  _id?: string
  url: string // Original image URL
  base64: string // Base64 encoded image data
  mimeType?: string // Image MIME type (e.g., 'image/png', 'image/jpeg')
  lastUpdated: Date
}

/**
 * Save or update a wiki image (base64)
 */
export async function saveWikiImage(url: string, base64: string, mimeType?: string): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    await collection.updateOne(
      { url },
      {
        $set: {
          url,
          base64,
          mimeType,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error saving wiki image:', error)
    throw error
  }
}

/**
 * Get wiki image by URL
 */
export async function getWikiImage(url: string): Promise<WikiImageDocument | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    return collection.findOne({ url })
  } catch (error) {
    console.error('Error getting wiki image:', error)
    throw error
  }
}

/**
 * Get multiple wiki images by URLs
 */
export async function getWikiImages(urls: string[]): Promise<Map<string, string>> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    const images = await collection.find({ url: { $in: urls } }).toArray()
    
    const imageMap = new Map<string, string>()
    images.forEach((img) => {
      imageMap.set(img.url, img.base64)
    })

    return imageMap
  } catch (error) {
    console.error('Error getting wiki images:', error)
    throw error
  }
}

/**
 * Get all wiki images
 */
export async function getAllWikiImages(): Promise<WikiImageDocument[]> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    return collection.find({}).toArray()
  } catch (error) {
    console.error('Error getting all wiki images:', error)
    throw error
  }
}

/**
 * Delete wiki image by URL
 */
export async function deleteWikiImage(url: string): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    await collection.deleteOne({ url })
  } catch (error) {
    console.error('Error deleting wiki image:', error)
    throw error
  }
}

/**
 * Get image count
 */
export async function getWikiImageCount(): Promise<number> {
  try {
    const db = await getDatabase()
    const collection = db.collection<WikiImageDocument>(COLLECTION_NAME)

    return collection.countDocuments()
  } catch (error) {
    console.error('Error getting wiki image count:', error)
    throw error
  }
}

