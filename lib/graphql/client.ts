const GRAPHQL_ENDPOINT = 'https://api.tarkov.dev/graphql'

export interface GraphQLResponse<T = unknown> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: Array<string | number>
  }>
}

/**
 * Execute a GraphQL query
 */
export async function executeGraphQLQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (result.errors) {
      console.error('GraphQL errors:', result.errors)
      throw new Error(`GraphQL errors: ${result.errors.map((e: { message: string }) => e.message).join(', ')}`)
    }

    return result
  } catch (error) {
    console.error('Error executing GraphQL query:', error)
    throw error
  }
}

/**
 * Execute a GraphQL query with retry logic
 */
export async function executeGraphQLQueryWithRetry<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<GraphQLResponse<T>> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await executeGraphQLQuery<T>(query, variables)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt) // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('GraphQL query failed after retries')
}

