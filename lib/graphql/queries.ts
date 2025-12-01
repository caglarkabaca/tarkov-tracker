/**
 * GraphQL Queries for Tarkov.dev API
 */

export const QUESTS_QUERY = `
  query quests {
    tasks(gameMode: regular, limit: 9999) {
      id
      name
      normalizedName
      minPlayerLevel
      experience
      taskImageLink
      wikiLink
      restartable
      kappaRequired
      lightkeeperRequired
      map {
        id
        name
        normalizedName
      }
      trader {
        id
        name
        normalizedName
        image4xLink
      }
      traderRequirements {
        trader {
          id
          name
        }
        level
      }
      taskRequirements {
        task {
          trader {
            id
            name
          }
          id
          name
          normalizedName
        }
        status
      }
      objectives {
        id
        type
        description
        optional
        maps {
          id
          name
          normalizedName
        }
      }
      startRewards {
        items {
          item {
            id
            name
            normalizedName
            imageLink
            image512pxLink
            image8xLink
          }
          count
        }
        traderStanding {
          trader {
            id
            name
          }
          standing
        }
      }
      finishRewards {
        items {
          item {
            id
            name
            normalizedName
            imageLink
            image512pxLink
            image8xLink
          }
          count
        }
        traderStanding {
          trader {
            id
            name
          }
          standing
        }
      }
      failureOutcome {
        items {
          item {
            id
            name
            normalizedName
            imageLink
            image512pxLink
            image8xLink
          }
          count
        }
        traderStanding {
          trader {
            id
            name
          }
          standing
        }
      }
    }
  }
`

export const TRADERS_QUERY = `
  query traders {
    traders {
      id
      name
      normalizedName
      image4xLink
    }
  }
`
