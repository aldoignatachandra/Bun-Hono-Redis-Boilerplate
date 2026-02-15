import { Context } from 'hono';
import { UAParser } from 'ua-parser-js';

export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  deviceType: string;
}

/**
 * Extracts metadata from the request, including IP address, User Agent, and Device Type.
 * Handles various proxy headers to find the real client IP.
 */
export const getRequestMetadata = (c: Context): RequestMetadata => {
  // 1. Determine IP Address
  // Comprehensive list of headers to check for client IP
  const headersToCheck = [
    'x-client-ip',
    'x-forwarded-for',
    'cf-connecting-ip',
    'fastly-client-ip',
    'true-client-ip',
    'x-real-ip',
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  let ipAddress = 'unknown';

  for (const header of headersToCheck) {
    const value = c.req.header(header);
    if (value) {
      // Handle comma-separated lists (e.g. x-forwarded-for: client, proxy1, proxy2)
      const firstIp = value.split(',')[0].trim();
      // Basic validation to ensure it's not empty
      if (firstIp) {
        ipAddress = firstIp;
        break;
      }
    }
  }

  // Fallback if no headers found (e.g., direct connection in dev)
  // Note: Hono's c.req.raw might not expose socket info directly in all environments (like Cloudflare Workers),
  // but for Node/Bun, it often requires bindings. We default to 'unknown' or localhost if testing.
  if (ipAddress === 'unknown' && process.env.NODE_ENV === 'development') {
    ipAddress = '127.0.0.1';
  }

  // 2. Parse User Agent & Device Type
  const userAgentString = c.req.header('user-agent') || 'unknown';
  const parser = new UAParser(userAgentString);
  const deviceType = parser.getDevice().type || 'desktop'; // UAParser returns undefined for desktop usually

  return {
    ipAddress,
    userAgent: userAgentString,
    deviceType,
  };
};
