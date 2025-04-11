import axios from 'axios';

const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;

// Basic structure for file or commit results
export interface SearchResult {
  type: 'file' | 'commit' | 'diff' | 'other';
  repo: string;
  file?: string;
  line?: number;
  snippet?: string;
  commitID?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
}

/**
 * Execute a Sourcegraph search query (GraphQL). 
 * Could be type:file, type:commit, or type:diff depending on user query.
 * 
 * @param sgQuery e.g. 'repo:myorg/.* functionName type:file count:all'
 */
export async function searchSourcegraph(sgQuery: string): Promise<SearchResult[]> {
  const graphqlQuery = `
    query CodeSearch($query: String!) {
      search(query: $query, version: V3) {
        results {
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
            ... on CommitSearchResult {
              commits {
                oid
                message
                author {
                  person {
                    name
                    email
                  }
                  date
                }
              }
              diff {
                fileDiffs {
                  diff
                  nodes {
                    oldPath
                    newPath
                    hunks {
                      body
                      section
                      oldRange { start, lines }
                      newRange { start, lines }
                    }
                  }
                }
              }
              refs {
                name
              }
              repository { name }
            }
          }
        }
      }
    }
  `;

  const headers = {
    'Authorization': `token ${sgToken}`,
    'Content-Type': 'application/json'
  };

  if (!sgUrl) {
    console.error('SOURCEGRAPH_URL env var:', process.env.SOURCEGRAPH_URL);
    throw new Error('SOURCEGRAPH_URL is not set');
  }
  if (!sgToken) {
    throw new Error('SOURCEGRAPH_TOKEN is not set');
  }

  // Make sure the URL has the correct format
  const baseUrl = sgUrl.endsWith('/') ? sgUrl.slice(0, -1) : sgUrl;

  const response = await axios.post(
    `${baseUrl}/.api/graphql`,
    { query: graphqlQuery, variables: { query: sgQuery } },
    { headers }
  );

  if (response.data.errors) {
    throw new Error(`Sourcegraph GraphQL Error: ${JSON.stringify(response.data.errors)}`);
  }

  const rawResults = response.data.data.search.results.results;
  const allResults: SearchResult[] = [];

  for (const result of rawResults) {
    switch (result.__typename) {
      case 'FileMatch':
        // type:file or basic code search
        const repoName = result.repository.name;
        const filePath = result.file.path;
        for (const lineMatch of result.lineMatches) {
          allResults.push({
            type: 'file',
            repo: repoName,
            file: filePath,
            line: lineMatch.lineNumber,
            snippet: lineMatch.preview
          });
        }
        break;

      case 'CommitSearchResult':
        // type:commit or type:diff
        const commits = result.commits;
        const repo = result.repository.name;
        for (const commit of commits) {
          const commitData: SearchResult = {
            type: 'commit',
            repo,
            commitID: commit.oid,
            commitMessage: commit.message,
            commitAuthor: commit.author.person.name,
            commitDate: commit.author.date
          };

          // If it's from a diff-based search, we can look at the diff content
          if (result.diff && result.diff.fileDiffs) {
            // This indicates a type:diff search or commits with diffs
            commitData.type = 'diff'; // we can classify as 'diff' if there's a diff
          }

          allResults.push(commitData);
        }
        break;

      default:
        // Other result types could appear, e.g. RepoMatch, SymbolMatch, etc.
        allResults.push({
          type: 'other',
          repo: '',
        });
        break;
    }
  }

  return allResults;
}