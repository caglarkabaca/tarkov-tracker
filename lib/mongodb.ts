import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI || ''

if (!uri) {
  console.warn('⚠️  MONGODB_URI is not set. Please add your Mongo URI to .env.local')
  console.warn('⚠️  MongoDB operations will fail without a valid connection string.')
}

const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

if (!uri) {
  // Create a dummy promise that will reject when used
  clientPromise = Promise.reject(new Error('MONGODB_URI is not configured'))
} else if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

/**
 * Gets the MongoDB database instance
 * @param dbName - Database name (default: "tarkovquest")
 * @returns MongoDB database instance
 */
export async function getDatabase(dbName?: string): Promise<Db> {
  const client = await clientPromise
  const databaseName = dbName || process.env.MONGODB_DB_NAME || 'tarkovquest'
  return client.db(databaseName)
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

