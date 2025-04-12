"use strict";
/**
 * Sourcegraph API Service
 * Handles direct interactions with the Sourcegraph API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiffSearchQuery = exports.getCommitSearchQuery = exports.getFileSearchQuery = exports.executeSourcegraphSearch = exports.searchSourcegraph = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
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
async function searchSourcegraph(query) {
    const config = getSourcegraphConfig();
    let graphqlQuery;
    // Determine the appropriate query based on the search type
    if (query.includes('type:commit')) {
        graphqlQuery = getCommitSearchQuery();
    }
    else if (query.includes('type:diff')) {
        graphqlQuery = getDiffSearchQuery();
    }
    else {
        graphqlQuery = getFileSearchQuery();
    }
    return executeSourcegraphSearch(query, graphqlQuery, config);
}
exports.searchSourcegraph = searchSourcegraph;
/**
 * Execute a search query against the Sourcegraph API
 */
async function executeSourcegraphSearch(query, graphqlQuery, sourcegraphConfig) {
    // Headers for Sourcegraph API
    const headers = {
        'Authorization': `token ${sourcegraphConfig.token}`,
        'Content-Type': 'application/json'
    };
    // Make the request to Sourcegraph API
    const response = await axios_1.default.post(`${sourcegraphConfig.url}/.api/graphql`, { query: graphqlQuery, variables: { query } }, { headers });
    return response.data;
}
exports.executeSourcegraphSearch = executeSourcegraphSearch;
/**
 * Get GraphQL query for file search
 */
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
exports.getFileSearchQuery = getFileSearchQuery;
/**
 * Get GraphQL query for commit search
 */
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
exports.getCommitSearchQuery = getCommitSearchQuery;
/**
 * Get GraphQL query for diff search
 */
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
exports.getDiffSearchQuery = getDiffSearchQuery;
