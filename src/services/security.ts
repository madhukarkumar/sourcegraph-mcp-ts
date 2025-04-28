/**
 * Security Service
 * 
 * Provides access to Sourcegraph's security APIs for features like:
 * - CVE lookups
 * - Package vulnerability scans
 * - Exploit code searches
 * - Vendor security advisory lookups
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API response type
export type SecurityResponse = {
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
 * Execute a regular Sourcegraph search and return the results
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
 * Get GraphQL query for CVE lookup
 */
export function getCVELookupQuery() {
  return `
    query CVELookup($cveId: String, $package: String, $repository: String, $limit: Int!) {
      vulnerabilities(first: $limit, cve: $cveId, package: $package, repository: $repository) {
        nodes {
          type
          id
          severity
          package {
            name
            ecosystem
          }
          affectedVersions
          fixedVersions
          summary
          details
          published
          references {
            url
            type
          }
        }
        totalCount
      }
    }
  `;
}

/**
 * Get GraphQL query for package vulnerability lookup
 */
export function getPackageVulnerabilityQuery() {
  return `
    query PackageVulnerability($package: String!, $version: String, $limit: Int!) {
      vulnerabilities(first: $limit, package: $package, version: $version) {
        nodes {
          type
          id
          severity
          package {
            name
            ecosystem
          }
          affectedVersions
          fixedVersions
          summary
          details
          published
          references {
            url
            type
          }
        }
        totalCount
      }
    }
  `;
}

/**
 * Format CVE lookup results to readable output
 */
export function formatCVELookupResults(data: any, params: { cveId?: string, package?: string, repository?: string }): string {
  // Handle error cases
  if (!data?.vulnerabilities?.nodes) {
    return "No vulnerability data found.";
  }

  const nodes = data.vulnerabilities.nodes;
  const totalCount = data.vulnerabilities.totalCount;
  
  if (nodes.length === 0) {
    return "No vulnerabilities found matching the criteria.";
  }

  // Build query description
  let queryDesc = "";
  if (params.cveId) {
    queryDesc += `CVE ID: ${params.cveId}`;
  }
  if (params.package) {
    queryDesc += queryDesc ? `, Package: ${params.package}` : `Package: ${params.package}`;
  }
  if (params.repository) {
    queryDesc += queryDesc ? `, Repository: ${params.repository}` : `Repository: ${params.repository}`;
  }

  // Format for display
  let result = `## Vulnerabilities Found (${totalCount})\n\n`;
  if (queryDesc) {
    result += `Search criteria: ${queryDesc}\n\n`;
  }

  nodes.forEach((vuln: any, index: number) => {
    const vulnId = vuln.id;
    const severity = formatSeverity(vuln.severity);
    const pkgName = vuln.package?.name || "Unknown";
    const ecosystem = vuln.package?.ecosystem || "Unknown";
    
    result += `### ${index + 1}. ${vulnId} - ${pkgName} (${ecosystem})\n\n`;
    result += `**Severity:** ${severity}\n\n`;
    
    if (vuln.summary) {
      result += `**Summary:** ${vuln.summary}\n\n`;
    }
    
    if (vuln.affectedVersions && vuln.affectedVersions.length > 0) {
      result += `**Affected Versions:** ${vuln.affectedVersions.join(', ')}\n\n`;
    }
    
    if (vuln.fixedVersions && vuln.fixedVersions.length > 0) {
      result += `**Fixed Versions:** ${vuln.fixedVersions.join(', ')}\n\n`;
    }
    
    if (vuln.published) {
      result += `**Published:** ${formatDate(vuln.published)}\n\n`;
    }
    
    if (vuln.references && vuln.references.length > 0) {
      result += `**References:**\n`;
      vuln.references.forEach((ref: any) => {
        result += `- [${ref.type || 'Link'}](${ref.url})\n`;
      });
      result += "\n";
    }
    
    if (vuln.details) {
      result += `**Details:**\n${vuln.details}\n\n`;
    }
    
    if (index < nodes.length - 1) {
      result += "---\n\n";
    }
  });

  return result;
}

/**
 * Format package vulnerability results to readable output
 */
export function formatPackageVulnerabilityResults(data: any, params: { package: string, version?: string }): string {
  // Handle error cases
  if (!data?.vulnerabilities?.nodes) {
    return "No vulnerability data found.";
  }

  const nodes = data.vulnerabilities.nodes;
  const totalCount = data.vulnerabilities.totalCount;
  
  if (nodes.length === 0) {
    return `No vulnerabilities found for package ${params.package}${params.version ? ` version ${params.version}` : ''}.`;
  }

  // Format for display
  let result = `## Security Vulnerabilities for ${params.package}${params.version ? ` v${params.version}` : ''}\n\n`;
  result += `Found ${totalCount} vulnerabilities\n\n`;

  // Add severity summary
  const severityCounts: Record<string, number> = {};
  nodes.forEach((vuln: any) => {
    const severity = vuln.severity || "unknown";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
  });
  
  result += "**Severity Summary:**\n";
  const severityOrder = ["critical", "high", "moderate", "medium", "low", "unknown"];
  severityOrder.forEach(severity => {
    if (severityCounts[severity]) {
      result += `- ${formatSeverity(severity)}: ${severityCounts[severity]}\n`;
    }
  });
  result += "\n";

  // Detail each vulnerability
  nodes.forEach((vuln: any, index: number) => {
    const vulnId = vuln.id;
    const severity = formatSeverity(vuln.severity);
    
    result += `### ${index + 1}. ${vulnId}\n\n`;
    result += `**Severity:** ${severity}\n\n`;
    
    if (vuln.summary) {
      result += `**Summary:** ${vuln.summary}\n\n`;
    }
    
    if (vuln.affectedVersions && vuln.affectedVersions.length > 0) {
      result += `**Affected Versions:** ${vuln.affectedVersions.join(', ')}\n\n`;
    }
    
    if (vuln.fixedVersions && vuln.fixedVersions.length > 0) {
      result += `**Fixed Versions:** ${vuln.fixedVersions.join(', ')}\n\n`;
    }
    
    if (vuln.references && vuln.references.length > 0) {
      result += `**References:**\n`;
      vuln.references.forEach((ref: any) => {
        result += `- [${ref.type || 'Link'}](${ref.url})\n`;
      });
      result += "\n";
    }
    
    if (index < nodes.length - 1) {
      result += "---\n\n";
    }
  });

  return result;
}

/**
 * Format severity to readable and colored format
 */
function formatSeverity(severity: string): string {
  if (!severity) return "Unknown";
  
  severity = severity.toLowerCase();
  switch (severity) {
    case "critical":
      return "⚠️ Critical";
    case "high":
      return "🔴 High";
    case "moderate":
    case "medium":
      return "🟠 Medium";
    case "low":
      return "🟡 Low";
    default:
      return "ℹ️ " + severity.charAt(0).toUpperCase() + severity.slice(1);
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
 * Build a search query for exploits based on CVE ID
 */
export function buildExploitSearchQuery(cveId: string): string {
  return `type:file (${cveId} OR "${cveId}") (poc OR exploit OR proof-of-concept) count:20`;
}

/**
 * Build a search query for vendor security advisories
 */
export function buildVendorAdvisorySearchQuery(vendor: string, product: string): string {
  return `type:file "${vendor}" "${product}" (security OR advisory OR vulnerability OR CVE) count:20`;
}