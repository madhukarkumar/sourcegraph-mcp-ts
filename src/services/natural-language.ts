/**
 * Natural language processing for search queries
 */

import axios from 'axios';
import { analyzeQuery, formatSearchResults } from '../utils/formatter';

// Define MCP response type to match SDK expectations
type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

interface SearchParams {
  query: string;
  type?: string;
  author?: string;
  after?: string;
  repos?: string[];
}

/**
 * Executes a search based on a natural language query
 */
export async function naturalLanguageSearch(naturalQuery: string, sourcegraphConfig: {
  url: string;
  token: string;
}): Promise<McpToolResponse> {
  try {
    // Extract structured query parameters from natural language
    const {
      type = 'file',
      query,
      author,
      after,
      repos = []
    } = analyzeQuery(naturalQuery);

    // Base search query
    let searchQuery = query;
    
    // Add type filter
    searchQuery += ` type:${type}`;
    
    // Add author filter for commit and diff searches
    if (author && (type === 'commit' || type === 'diff')) {
      searchQuery += ` author:${author}`;
    }
    
    // Add date filter
    if (after && (type === 'commit' || type === 'diff')) {
      searchQuery += ` after:${after}`;
    }
    
    // Add repository filters
    if (repos.length > 0) {
      const repoFilters = repos.map(repo => {
        // If it looks like a GitHub repo (contains a slash), format accordingly
        if (repo.includes('/')) {
          return `repo:^github\\.com/${repo}$`;
        }
        // Otherwise use as-is
        return `repo:${repo}`;
      });
      searchQuery += ` ${repoFilters.join(' ')}`;
    }
    
    // Add result count limit
    searchQuery += ' count:20';
    
    // Select the appropriate GraphQL query based on search type
    let graphqlQuery;
    if (type === 'file') {
      graphqlQuery = getFileSearchQuery();
    } else if (type === 'commit') {
      graphqlQuery = getCommitSearchQuery();
    } else if (type === 'diff') {
      graphqlQuery = getDiffSearchQuery();
    } else {
      throw new Error(`Unsupported search type: ${type}`);
    }
    
    // Headers for Sourcegraph API
    const headers = {
      'Authorization': `token ${sourcegraphConfig.token}`,
      'Content-Type': 'application/json'
    };
    
    // Make the request to Sourcegraph API
    const response = await axios.post(
      `${sourcegraphConfig.url}/.api/graphql`,
      { query: graphqlQuery, variables: { query: searchQuery } },
      { headers }
    );
    
    // Check for API errors
    if (response.data.errors) {
      return {
        content: [{ 
          type: "text", 
          text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}` 
        }],
        isError: true
      };
    }
    
    // Prepare results for formatting
    const results = response.data.data.search.results;
    
    // Generate a natural language response
    const naturalResponse = formatSearchResults(results, { query, type });
    
    return {
      content: [{ 
        type: "text", 
        text: naturalResponse
      }]
    } as McpToolResponse;
    
  } catch (error: any) {
    return {
      content: [{ 
        type: "text", 
        text: `Error processing natural language search: ${error.message || 'Unknown error'}` 
      }],
      isError: true
    } as McpToolResponse;
  }
}

// GraphQL query for file search
function getFileSearchQuery() {
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

// GraphQL query for commit search
function getCommitSearchQuery() {
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

// GraphQL query for diff search
function getDiffSearchQuery() {
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