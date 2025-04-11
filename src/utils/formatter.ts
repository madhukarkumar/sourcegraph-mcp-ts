/**
 * Result formatter utilities for natural language processing of search results
 */

interface RepositoryGroup {
  name: string;
  files: Record<string, FileMatch[]>;
  commits?: CommitMatch[];
  diffs?: DiffMatch[];
}

interface FileMatch {
  path: string;
  lineNumber: number;
  preview: string;
}

interface CommitMatch {
  oid: string;
  message: string;
  author: string;
  email?: string;
  date: string;
}

interface DiffMatch {
  commitInfo: CommitMatch;
  fileDiffs: {
    oldPath?: string;
    newPath?: string;
    hunks: {
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      body: string;
    }[];
  }[];
}

/**
 * Groups results by repository and formats them for human readability
 */
export function formatSearchResults(results: any, queryInfo: { query: string; type: string }) {
  const { query, type } = queryInfo;
  const matchCount = results.matchCount;
  const items = results.results;

  // Early return for no results
  if (!items || items.length === 0) {
    return `No matches found for "${query}" with type:${type}.`;
  }

  // Group results by repository
  const repositories: Record<string, RepositoryGroup> = {};

  // Process each result item
  items.forEach((item: any) => {
    if (item.__typename === 'FileMatch') {
      const repoName = item.repository.name;
      const filePath = item.file.path;
      
      // Initialize repository if not exists
      if (!repositories[repoName]) {
        repositories[repoName] = { name: repoName, files: {} };
      }
      
      // Initialize file array if not exists
      if (!repositories[repoName].files[filePath]) {
        repositories[repoName].files[filePath] = [];
      }
      
      // Add line matches
      item.lineMatches.forEach((match: { lineNumber: number; preview: string }) => {
        repositories[repoName].files[filePath].push({
          path: filePath,
          lineNumber: match.lineNumber,
          preview: match.preview
        });
      });
    } else if (item.__typename === 'CommitSearchResult') {
      const commit = item.commit;
      const repoName = commit.repository.name;
      
      // Initialize repository if not exists
      if (!repositories[repoName]) {
        repositories[repoName] = { name: repoName, files: {} };
      }
      
      // Initialize commits array if not exists
      if (!repositories[repoName].commits) {
        repositories[repoName].commits = [];
      }
      
      // Add commit
      repositories[repoName].commits!.push({
        oid: commit.oid,
        message: commit.message,
        author: commit.author.person.name,
        email: commit.author.person.email,
        date: commit.author.date
      });
      
      // If it's a diff search result, process the diffs
      if (type === 'diff' && item.diff) {
        // Initialize diffs array if not exists
        if (!repositories[repoName].diffs) {
          repositories[repoName].diffs = [];
        }
        
        const fileDiffs = item.diff.fileDiffs.map((fileDiff: any) => {
          return {
            oldPath: fileDiff.oldPath,
            newPath: fileDiff.newPath,
            hunks: fileDiff.hunks ? fileDiff.hunks.map((hunk: any) => ({
              oldStart: hunk.oldRange.start,
              oldLines: hunk.oldRange.lines,
              newStart: hunk.newRange.start,
              newLines: hunk.newRange.lines,
              body: hunk.body
            })) : []
          };
        });
        
        repositories[repoName].diffs!.push({
          commitInfo: {
            oid: commit.oid,
            message: commit.message,
            author: commit.author.person.name,
            date: commit.author.date
          },
          fileDiffs
        });
      }
    }
  });

  // Format results as natural language
  return generateNaturalLanguageResponse(repositories, { query, type, matchCount });
}

/**
 * Generate a natural language response from the structured data
 */
function generateNaturalLanguageResponse(
  repositories: Record<string, RepositoryGroup>,
  queryInfo: { query: string; type: string; matchCount: number }
) {
  const { query, type, matchCount } = queryInfo;
  const repoNames = Object.keys(repositories);
  
  // Create summary line
  let response = `Your search for "${query}" found ${matchCount} matches across ${repoNames.length} repositories.\n\n`;
  
  // Generate structured response by repository
  repoNames.forEach((repoName, index) => {
    const repo = repositories[repoName];
    response += `${index + 1}. **${repoName} repo**:\n\n`;
    
    // Handle file matches
    if (type === 'file') {
      const fileNames = Object.keys(repo.files);
      if (fileNames.length > 0) {
        fileNames.forEach(fileName => {
          response += `   * **${fileName}**:\n`;
          repo.files[fileName].forEach(match => {
            response += `     Line ${match.lineNumber}: \`${escapeMarkdown(match.preview)}\`\n`;
          });
          response += '\n';
        });
      }
    }
    
    // Handle commit matches
    else if (type === 'commit' && repo.commits && repo.commits.length > 0) {
      repo.commits.forEach(commit => {
        const shortId = commit.oid.substring(0, 7);
        response += `   * Commit ${shortId} by ${commit.author}\n`;
        response += `     Date: ${formatDate(commit.date)}\n`;
        response += `     Message: ${escapeMarkdown(commit.message.trim())}\n\n`;
      });
    }
    
    // Handle diff matches
    else if (type === 'diff' && repo.diffs && repo.diffs.length > 0) {
      repo.diffs.forEach(diff => {
        const shortId = diff.commitInfo.oid.substring(0, 7);
        response += `   * Changes in commit ${shortId} by ${diff.commitInfo.author}\n`;
        response += `     Date: ${formatDate(diff.commitInfo.date)}\n`;
        response += `     Message: ${escapeMarkdown(diff.commitInfo.message.trim())}\n\n`;
        
        diff.fileDiffs.forEach(fileDiff => {
          const filePath = fileDiff.newPath || fileDiff.oldPath || 'Unknown file';
          response += `     * **${filePath}**:\n`;
          
          // Limit hunks output to keep response reasonable
          const hunksToShow = fileDiff.hunks.slice(0, 2); // Show max 2 hunks per file
          hunksToShow.forEach(hunk => {
            response += `       @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
            // Limit diff content length
            const maxLines = 5;
            const diffLines = hunk.body.split('\n').slice(0, maxLines);
            diffLines.forEach(line => {
              response += `       ${escapeMarkdown(line)}\n`;
            });
            if (hunk.body.split('\n').length > maxLines) {
              response += '       ... (more lines)\n';
            }
            response += '\n';
          });
          
          if (fileDiff.hunks.length > 2) {
            response += `       ... (${fileDiff.hunks.length - 2} more change sections)\n\n`;
          }
        });
      });
    }
  });
  
  return response;
}

/**
 * Format a date string to a more readable format
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString; // Return original if parsing fails
  }
}

/**
 * Escape markdown special characters in text
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\*/g, '\\*')
    .replace(/\_/g, '\\_')
    .replace(/\~/g, '\\~')
    .replace(/\`/g, '\\`');
}

import { convertQueryToSourcegraphSyntax } from '../services/llm';

/**
 * Analyze a natural language query to determine search type and parameters
 * Now uses LLM-based parsing for more accurate conversion
 */
export async function analyzeQuery(query: string) {
  try {
    // Use LLM to convert the natural query to Sourcegraph syntax
    const sourcegraphQuery = await convertQueryToSourcegraphSyntax(query);
    console.log(`Converted query: ${sourcegraphQuery}`);
    
    // Parse the Sourcegraph query to extract components
    return parseSourcegraphQuery(sourcegraphQuery, query);
  } catch (error) {
    console.error('Error during query analysis with LLM:', error);
    // Fall back to the rule-based parsing if LLM fails
    return parseWithRules(query);
  }
}

/**
 * Parse a Sourcegraph syntax query to extract components
 */
function parseSourcegraphQuery(sourcegraphQuery: string, originalQuery: string) {
  // Default parameters
  let searchType = 'file';
  let searchQuery = sourcegraphQuery;
  let author = undefined;
  let after = undefined;
  const repos: string[] = [];
  
  // Extract search type
  const typeMatch = sourcegraphQuery.match(/\btype:(\w+)\b/);
  if (typeMatch) {
    searchType = typeMatch[1];
    // Remove the type: parameter from the search query
    searchQuery = searchQuery.replace(/\btype:\w+\b/, '').trim();
  }
  
  // Extract author
  const authorMatch = sourcegraphQuery.match(/\bauthor:([\w.-]+)\b/);
  if (authorMatch) {
    author = authorMatch[1];
    // Remove the author: parameter from the search query
    searchQuery = searchQuery.replace(/\bauthor:[\w.-]+\b/, '').trim();
  }
  
  // Extract date/after
  const afterMatch = sourcegraphQuery.match(/\bafter:(["'][^"']+["']|\S+)\b/);
  if (afterMatch) {
    after = afterMatch[1].replace(/["\']/g, '');
    // Remove the after: parameter from the search query
    searchQuery = searchQuery.replace(/\bafter:["'][^"']+["']|\bafter:\S+\b/, '').trim();
  }
  
  // Extract repositories
  const repoRegex = /\brepo:(["'][^"']+["']|\S+)\b/g;
  let repoMatch;
  while ((repoMatch = repoRegex.exec(sourcegraphQuery)) !== null) {
    const repoName = repoMatch[1].replace(/["\']/g, '');
    repos.push(repoName);
    // We don't remove repo: from searchQuery as it's often needed in the final query
  }

  // Clean up any extra spaces
  searchQuery = searchQuery.replace(/\s+/g, ' ').trim();
  
  return {
    type: searchType,
    query: searchQuery,
    author,
    after,
    repos,
    originalQuery  // Keep the original query for reference
  };
}

/**
 * Legacy rule-based parsing as fallback
 */
function parseWithRules(query: string) {
  // Default parameters
  let searchType = 'file';
  let searchQuery = query;
  let author = undefined;
  let after = undefined;
  const repos: string[] = [];
  
  // Extract search type
  if (/\b(commit|commits)\b/i.test(query)) {
    searchType = 'commit';
  } else if (/\b(diff|diffs|change|changes|pr|prs|pull request|pull requests)\b/i.test(query)) {
    searchType = 'diff';
  }
  
  // Extract author
  const authorMatch = query.match(/\b(?:by|from|author)\s+([\w.-]+)\b/i);
  if (authorMatch) {
    author = authorMatch[1];
  }
  
  // Extract date
  const dateMatch = query.match(/\b(?:after|since)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (dateMatch) {
    after = dateMatch[1];
  }
  
  // Extract repositories
  const repoMatches = query.match(/\bin\s+repo(?:sitory)?\s+([\w\/.-]+)\b/ig);
  if (repoMatches) {
    repoMatches.forEach(match => {
      const repoName = match.replace(/\bin\s+repo(?:sitory)?\s+/i, '');
      repos.push(repoName);
    });
  }
  
  // Clean up the search query (remove extracted metadata)
  if (author) {
    searchQuery = searchQuery.replace(new RegExp(`\\b(?:by|from|author)\\s+${author}\\b`, 'i'), '');
  }
  if (after) {
    searchQuery = searchQuery.replace(new RegExp(`\\b(?:after|since)\\s+${after}\\b`, 'i'), '');
  }
  if (repos.length > 0) {
    repos.forEach(repo => {
      searchQuery = searchQuery.replace(new RegExp(`\\bin\\s+repo(?:sitory)?\\s+${repo}\\b`, 'i'), '');
    });
  }
  
  // Remove search type indicators from the query
  searchQuery = searchQuery
    .replace(/\b(search for|find|look for)\b/i, '')
    .replace(/\b(commit|commits|diff|diffs|change|changes|pr|prs|pull request|pull requests)\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    type: searchType,
    query: searchQuery,
    author,
    after,
    repos,
    originalQuery: query  // Keep the original query for reference
  };
}