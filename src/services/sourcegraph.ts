/**
 * Sourcegraph API Service
 * Handles direct interactions with the Sourcegraph API
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API response type
export type SourcegraphResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

// Get Sourcegraph configuration from environment
const getSourcegraphConfig = () => {
  const url = process.env.SOURCEGRAPH_URL;
  const token = process.env.SOURCEGRAPH_TOKEN;
  
  if (!url || !token) {
    throw new Error('Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables.');
  }
  
  return { url, token };
};

/**
 * Search Sourcegraph with a query - for Express API routes
 */
export async function searchSourcegraph(query: string): Promise<any> {
  const config = getSourcegraphConfig();
  let graphqlQuery;
  
  // Determine the appropriate query based on the search type
  if (query.includes('type:commit')) {
    graphqlQuery = getCommitSearchQuery();
  } else if (query.includes('type:diff')) {
    graphqlQuery = getDiffSearchQuery();
  } else {
    graphqlQuery = getFileSearchQuery();
  }
  
  return executeSourcegraphSearch(query, graphqlQuery, config);
}

/**
 * Execute a search query against the Sourcegraph API
 */
export async function executeSourcegraphSearch(
  query: string,
  graphqlQuery: string,
  sourcegraphConfig: {
    url: string;
    token: string;
  }
): Promise<any> {
  // Headers for Sourcegraph API
  const headers = {
    'Authorization': `token ${sourcegraphConfig.token}`,
    'Content-Type': 'application/json'
  };
  
  // Make the request to Sourcegraph API
  const response = await axios.post(
    `${sourcegraphConfig.url}/.api/graphql`,
    { query: graphqlQuery, variables: { query } },
    { headers }
  );
  
  return response.data;
}

/**
 * Get GraphQL query for file search
 */
export function getFileSearchQuery() {
  return `
    query FileSearch($query: String!) {
      search(query: $query, version: V3) {
        results {
          matchCount
          results {
            __typename
            ... on FileMatch {
              repository { name }
              file { path }
              lineMatches {
                lineNumber
                preview
              }
            }
          }
        }
      }
    }
  `;
}

/**
 * Get GraphQL query for commit search
 */
export function getCommitSearchQuery() {
  return `
    query CommitSearch($query: String!) {
      search(query: $query, version: V3) {
        results {
          matchCount
          results {
            __typename
            ... on CommitSearchResult {
              commit {
                oid
                message
                author {
                  person {
                    name
                    email
                  }
                  date
                }
                repository { name }
              }
            }
          }
        }
      }
    }
  `;
}

/**
 * Get GraphQL query for diff search
 */
export function getDiffSearchQuery() {
  return `
    query DiffSearch($query: String!) {
      search(query: $query, version: V3) {
        results {
          matchCount
          results {
            __typename
            ... on CommitSearchResult {
              commit {
                oid
                message
                author {
                  person {
                    name
                    email
                  }
                  date
                }
                repository { name }
              }
              diff {
                fileDiffs {
                  oldPath
                  newPath
                  hunks {
                    body
                    oldRange { start, lines }
                    newRange { start, lines }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}