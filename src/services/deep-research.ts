/**
 * Deep Code Research Service
 * Handles deep code research functionality separate from the main MCP server
 */

import axios from 'axios';

/**
 * Perform deep code research on a given query
 */
export async function performDeepCodeResearch(params: {
  query: string;
  repo?: string;
  language?: string;
  limit?: number;
  url: string;
  token: string;
}) {
  const { query, repo, language, limit = 20, url, token } = params;
  
  try {
    console.error('Deep research service called with params:', { query, repo, language, limit });
    
    // Build the search query
    let searchQuery = query;
    
    // Add repository filter if specified
    if (repo) {
      if (!repo.includes('/')) {
        // If repo doesn't contain '/', assume it's a GitHub username/org
        searchQuery += ` repo:^github\\.com/${repo}/`;
      } else if (!repo.includes('.')) {
        // If repo has '/' but no domain, assume GitHub
        searchQuery += ` repo:^github\\.com/${repo}$`;
      } else {
        // Full domain specified
        searchQuery += ` repo:${repo}`;
      }
    }
    
    // Add language filter if specified
    if (language) {
      searchQuery += ` lang:${language}`;
    }
    
    // Add count parameter
    searchQuery += ` count:${limit}`;
    
    console.error('Constructed search query:', searchQuery);
    
    // Headers for Sourcegraph API
    const headers = {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    };
    
    // 1. First search: File search
    const fileQuery = searchQuery + ' type:file';
    const fileSearchQuery = `
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
    
    console.error('Executing file search with query:', fileQuery);
    
    const fileResponse = await axios.post(
      `${url}/.api/graphql`,
      { query: fileSearchQuery, variables: { query: fileQuery } },
      { headers }
    );
    
    // 2. Second search: Commit search
    const commitQuery = searchQuery + ' type:commit';
    const commitSearchQuery = `
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
    
    console.error('Executing commit search with query:', commitQuery);
    
    const commitResponse = await axios.post(
      `${url}/.api/graphql`,
      { query: commitSearchQuery, variables: { query: commitQuery } },
      { headers }
    );
    
    // Format results
    let resultsText = `## Deep Code Research: ${query}\n\n`;
    
    // Process file search results
    const fileResults = fileResponse.data.data.search.results;
    console.error(`File search found ${fileResults.matchCount} matches`);
    
    if (fileResults.matchCount > 0 && fileResults.results.length > 0) {
      resultsText += `### Code Findings\n`;
      resultsText += `Found ${fileResults.matchCount} code matches.\n\n`;
      
      // Group results by repository
      const repoMap = {};
      
      fileResults.results.forEach(item => {
        if (item.__typename === 'FileMatch') {
          const repoName = item.repository.name;
          const filePath = item.file.path;
          
          if (!repoMap[repoName]) {
            repoMap[repoName] = {};
          }
          
          if (!repoMap[repoName][filePath]) {
            repoMap[repoName][filePath] = [];
          }
          
          item.lineMatches.forEach(match => {
            repoMap[repoName][filePath].push({
              lineNumber: match.lineNumber,
              preview: match.preview
            });
          });
        }
      });
      
      // Format results by repository
      Object.keys(repoMap).forEach((repoName, repoIndex) => {
        resultsText += `${repoIndex + 1}. **${repoName}**:\n\n`;
        
        Object.keys(repoMap[repoName]).forEach(filePath => {
          resultsText += `   * **${filePath}**:\n`;
          
          repoMap[repoName][filePath].slice(0, 5).forEach(match => {
            resultsText += `     Line ${match.lineNumber}: \`${escapeMarkdown(match.preview)}\`\n`;
          });
          
          if (repoMap[repoName][filePath].length > 5) {
            resultsText += `     ... and ${repoMap[repoName][filePath].length - 5} more matches\n`;
          }
          
          resultsText += '\n';
        });
      });
      
      // Add code insights
      resultsText += "### Code Patterns & Insights\n";
      
      // Analyze file types and directories
      const fileTypes = {};
      const directories = {};
      
      fileResults.results.forEach(item => {
        if (item.__typename === 'FileMatch') {
          const filePath = item.file.path;
          
          // Track file extensions
          const fileExt = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
          fileTypes[fileExt] = (fileTypes[fileExt] || 0) + 1;
          
          // Track directories
          const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
          if (dirPath) {
            directories[dirPath] = (directories[dirPath] || 0) + 1;
          }
        }
      });
      
      // List prominent files
      resultsText += "- Key files containing this functionality:\n";
      fileResults.results
        .filter(item => item.__typename === 'FileMatch' && item.lineMatches.length > 2)
        .slice(0, 5)
        .forEach(item => {
          resultsText += `  - \`${item.file.path}\` (${item.lineMatches.length} matches)\n`;
        });
      
      // Add file type statistics
      resultsText += "\n- File type distribution:\n";
      Object.entries(fileTypes)
        .filter(([_, count]) => count > 1)
        .forEach(([ext, count]) => {
          resultsText += `  - ${ext}: ${count} files\n`;
        });
      
      // Add directory statistics
      resultsText += "\n- Key directories:\n";
      Object.entries(directories)
        .sort(([_, countA], [__, countB]) => (countB as number) - (countA as number))
        .slice(0, 5)
        .filter(([dir, count]) => (count as number) > 1 && dir)
        .forEach(([dir, count]) => {
          resultsText += `  - ${dir}/: ${count} files\n`;
        });
    } else {
      resultsText += "### Code Findings\nNo code matches found.\n\n";
    }
    
    // Process commit search results
    const commitResults = commitResponse.data.data.search.results;
    console.error(`Commit search found ${commitResults.matchCount} matches`);
    
    if (commitResults.matchCount > 0 && commitResults.results.length > 0) {
      resultsText += `\n### Related Commits\n`;
      resultsText += `Found ${commitResults.matchCount} related commits.\n\n`;
      
      // Group results by repository
      const repoMap = {};
      
      commitResults.results.forEach(item => {
        if (item.__typename === 'CommitSearchResult' && item.commit) {
          const repoName = item.commit.repository.name;
          
          if (!repoMap[repoName]) {
            repoMap[repoName] = [];
          }
          
          repoMap[repoName].push({
            oid: item.commit.oid,
            message: item.commit.message,
            author: item.commit.author.person ? item.commit.author.person.name : 'Unknown',
            date: item.commit.author.date
          });
        }
      });
      
      // Format results by repository
      Object.keys(repoMap).forEach((repoName, repoIndex) => {
        resultsText += `${repoIndex + 1}. **${repoName}**:\n\n`;
        
        repoMap[repoName].forEach(commit => {
          const shortId = commit.oid.substring(0, 7);
          resultsText += `   * Commit ${shortId} by ${commit.author}\n`;
          resultsText += `     Date: ${formatDate(commit.date)}\n`;
          resultsText += `     Message: ${escapeMarkdown(commit.message.trim())}\n\n`;
        });
      });
      
      // Add commit insights
      resultsText += "### Development Insights\n";
      
      // Track authors and dates
      const authors = {};
      const datePattern = {};
      
      commitResults.results.forEach(item => {
        if (item.__typename === 'CommitSearchResult' && item.commit) {
          // Track commit authors
          if (item.commit.author && item.commit.author.person) {
            const author = item.commit.author.person.name || 'Unknown';
            authors[author] = (authors[author] || 0) + 1;
          }
          
          // Track commit dates
          if (item.commit.author && item.commit.author.date) {
            const date = new Date(item.commit.author.date);
            const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            datePattern[month] = (datePattern[month] || 0) + 1;
          }
        }
      });
      
      // Add author statistics
      resultsText += "- Main contributors:\n";
      Object.entries(authors)
        .sort(([_, countA], [__, countB]) => (countB as number) - (countA as number))
        .slice(0, 5)
        .forEach(([author, count]) => {
          resultsText += `  - ${author}: ${count} commits\n`;
        });
      
      // Add date pattern
      resultsText += "\n- Development timeline:\n";
      Object.entries(datePattern)
        .sort() // Sort chronologically
        .forEach(([month, count]) => {
          resultsText += `  - ${month}: ${count} commits\n`;
        });
    } else {
      resultsText += "\n### Related Commits\nNo related commits found.\n";
    }
    
    // Prepare structured data for agent consumption
    const structuredData = {
      query,
      repo: repo || 'all repositories',
      language: language || 'all languages',
      summary: {
        codeMatchCount: fileResults?.matchCount || 0,
        commitMatchCount: commitResults?.matchCount || 0,
        repositoriesFound: fileResults?.matchCount > 0 ? 
          Object.keys(fileResults.results.reduce((repos, item) => {
            if (item.__typename === 'FileMatch') {
              repos[item.repository.name] = true;
            }
            return repos;
          }, {})).length : 0
      },
      codeFindings: fileResults?.matchCount > 0 ? fileResults.results
        .filter(item => item.__typename === 'FileMatch')
        .map(item => ({
          repository: item.repository.name,
          path: item.file.path,
          matchCount: item.lineMatches.length,
          snippets: item.lineMatches.slice(0, 3).map(match => ({
            lineNumber: match.lineNumber,
            code: match.preview
          }))
        })) : [],
      commits: commitResults?.matchCount > 0 ? commitResults.results
        .filter(item => item.__typename === 'CommitSearchResult' && item.commit)
        .map(item => ({
          repository: item.commit.repository.name,
          id: item.commit.oid.substring(0, 7),
          message: item.commit.message.trim(),
          author: item.commit.author.person ? item.commit.author.person.name : 'Unknown',
          date: item.commit.author.date
        })) : []
    };
    
    // Combine markdown and JSON in a single text response for MCP compatibility
    const combinedText = resultsText + 
      '\n\n---\n\n' +
      '## Structured Data (JSON)\n' +
      '```json\n' +
      JSON.stringify(structuredData, null, 2) +
      '\n```\n';
    
    return {
      content: [{ 
        type: "text", 
        text: combinedText
      }]
    };
  } catch (error) {
    console.error('Deep code researcher service error:', error);
    
    // Build detailed error message
    let errorText = `Error in deep code research: ${error.message || 'Unknown error'}`;
    
    errorText += '\n\nDebugging Information:\n';
    errorText += `- Query: ${query}\n`;
    errorText += `- Repository: ${repo || 'Not specified'}\n`;
    errorText += `- Language: ${language || 'Not specified'}\n`;
    errorText += `- Limit: ${limit}\n`;
    
    if (error.response) {
      errorText += '\nAPI Response Error:\n';
      errorText += `- Status: ${error.response.status}\n`;
      errorText += `- Message: ${JSON.stringify(error.response.data)}\n`;
    }
    
    errorText += '\nPossible solutions:\n';
    errorText += '- Verify your Sourcegraph instance is accessible\n';
    errorText += '- Check if the specified repository exists\n';
    errorText += '- Try a more general query without repository filter\n';
    errorText += '- Confirm your Sourcegraph token has proper permissions\n';
    
    // Also include structured error data for agent consumption
    const errorData = {
      error: true,
      message: error.message || 'Unknown error',
      query,
      parameters: {
        repo: repo || null,
        language: language || null,
        limit
      },
      responseInfo: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null,
      suggestions: [
        'Verify your Sourcegraph instance is accessible',
        'Check if the specified repository exists',
        'Try a more general query without repository filter',
        'Confirm your Sourcegraph token has proper permissions'
      ]
    };
    
    // Combine error text and structured error data in a single response for MCP compatibility
    const combinedErrorText = errorText + 
      '\n\n---\n\n' +
      '## Error Details (JSON)\n' +
      '```json\n' +
      JSON.stringify(errorData, null, 2) +
      '\n```\n';
    
    return {
      content: [{ 
        type: "text", 
        text: combinedErrorText
      }],
      isError: true
    };
  }
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