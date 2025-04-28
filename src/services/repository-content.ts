/**
 * Repository Content Service
 * 
 * Provides access to Sourcegraph's API for retrieving repository content such as:
 * - File content
 * - File blame information
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API response type
export type RepositoryContentResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/**
 * Get Sourcegraph configuration from environment or provided config
 */
export const getSourcegraphConfig = (config?: { url?: string; token?: string }) => {
  const url = config?.url || process.env.SOURCEGRAPH_URL;
  const token = config?.token || process.env.SOURCEGRAPH_TOKEN;
  
  if (!url || !token) {
    throw new Error('Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables.');
  }
  
  return { url, token };
};

/**
 * Execute a GraphQL query against the Sourcegraph API
 */
export async function executeSourcegraphQuery(
  graphqlQuery: string,
  variables: Record<string, any>,
  sourcegraphConfig?: {
    url?: string;
    token?: string;
  }
): Promise<any> {
  // Get configuration
  const config = getSourcegraphConfig(sourcegraphConfig);
  
  // Headers for Sourcegraph API
  const headers = {
    'Authorization': `token ${config.token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Make the request to Sourcegraph API
    const response = await axios.post(
      `${config.url}/.api/graphql`,
      { query: graphqlQuery, variables },
      { headers }
    );
    
    return response.data;
  } catch (error: any) {
    // Format error for better debugging
    if (error.response) {
      throw new Error(`Sourcegraph API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`No response from Sourcegraph API: ${error.message}`);
    } else {
      throw new Error(`Error setting up request: ${error.message}`);
    }
  }
}

/**
 * Get GraphQL query for file content
 */
export function getFileContentQuery() {
  return `
    query FileContent($repository: String!, $path: String!, $revision: String) {
      repository(name: $repository) {
        commit(rev: $revision, default: "HEAD") {
          blob(path: $path) {
            content
            byteSize
            binary
          }
        }
      }
    }
  `;
}

/**
 * Get GraphQL query for file blame information
 */
export function getFileBlameQuery() {
  return `
    query FileBlame($repository: String!, $path: String!, $startLine: Int!, $endLine: Int!) {
      repository(name: $repository) {
        commit(rev: "HEAD") {
          blob(path: $path) {
            blame(startLine: $startLine, endLine: $endLine) {
              startLine
              endLine
              author
              email
              date
              message
              commit {
                oid
                abbrevOid
                message
                author {
                  person {
                    name
                    email
                  }
                  date
                }
              }
            }
          }
        }
      }
    }
  `;
}

/**
 * Format file content results to readable output
 */
export function formatFileContentResults(data: any, params: { repository: string, path: string, revision: string | undefined }): string {
  // Handle error cases
  if (!data?.repository?.commit?.blob) {
    return "File not found or repository access error.";
  }

  const blob = data.repository.commit.blob;
  
  if (blob.binary) {
    return `Binary file detected (${blob.byteSize} bytes). Cannot display binary file content.`;
  }

  // Format for display
  let result = `## File Content: ${params.repository}:${params.path}`;
  if (params.revision) {
    result += ` @ ${params.revision}`;
  }
  result += "\n\n";

  // Add file size info
  result += `File size: ${formatFileSize(blob.byteSize)}\n\n`;

  // Get file extension for syntax highlighting
  const fileExtension = params.path.split('.').pop() || '';
  
  // Add the content with proper syntax highlighting
  result += "```" + fileExtension + "\n";
  result += blob.content;
  result += "\n```";

  return result;
}

/**
 * Format file blame results to readable output
 */
export function formatFileBlameResults(data: any, params: { repository: string, path: string, startLine: number, endLine: number }): string {
  // Handle error cases
  if (!data?.repository?.commit?.blob?.blame) {
    return "Blame information not available or repository access error.";
  }

  const blameEntries = data.repository.commit.blob.blame;
  
  if (blameEntries.length === 0) {
    return "No blame information available for the specified lines.";
  }

  // Format for display
  let result = `## Blame Information: ${params.repository}:${params.path} (Lines ${params.startLine + 1}-${params.endLine + 1})\n\n`;

  // Format blame entries with table
  result += "| Lines | Author | Date | Commit | Message |\n";
  result += "|-------|--------|------|--------|---------|\n";

  blameEntries.forEach((entry: any) => {
    const startLine = entry.startLine + 1; // Convert to 1-indexed for display
    const endLine = entry.endLine + 1;     // Convert to 1-indexed for display
    const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
    const author = entry.commit?.author?.person?.name || entry.author || "Unknown";
    const date = formatDate(entry.commit?.author?.date || entry.date);
    const commitId = entry.commit?.abbrevOid || "Unknown";
    const message = formatCommitMessage(entry.commit?.message || entry.message || "No message");
    
    result += `| ${lineRange} | ${author} | ${date} | ${commitId} | ${message} |\n`;
  });

  return result;
}

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * Format date to readable format
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "Unknown";
  
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format commit message (truncate if too long)
 */
function formatCommitMessage(message: string): string {
  if (!message) return "No message";
  
  // Extract first line and truncate if needed
  const firstLine = message.split('\n')[0];
  if (firstLine.length > 50) {
    return firstLine.substring(0, 47) + "...";
  }
  return firstLine;
}