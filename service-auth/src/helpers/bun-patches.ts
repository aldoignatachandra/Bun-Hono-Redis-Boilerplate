/* eslint-disable @typescript-eslint/ban-ts-comment */

/**
 * Patch to suppress Bun's TimeoutNegativeWarning which occurs with KafkaJS.
 *
 * This is a known compatibility issue where KafkaJS calculates timeouts that result in negative values
 * (likely due to clock skew or aggressive timeouts) and Bun's strict timer implementation warns about them.
 *
 * This patch intercepts console.error, console.warn, process.emitWarning AND global.setTimeout/setInterval
 * to prevent these warnings from cluttering the logs.
 */

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalEmitWarning = process.emitWarning;
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;

// 1. Patch setTimeout to prevent negative values
// @ts-ignore
global.setTimeout = (callback: any, delay?: number, ...args: any[]) => {
  if (typeof delay === 'number' && delay < 0) {
    // Silently clamp to 1ms (mimics Bun's behavior but without the warning)
    delay = 1;
  }
  return originalSetTimeout(callback, delay, ...args);
};

// 2. Patch setInterval to prevent negative values
// @ts-ignore
global.setInterval = (callback: any, delay?: number, ...args: any[]) => {
  if (typeof delay === 'number' && delay < 0) {
    delay = 1;
  }
  return originalSetInterval(callback, delay, ...args);
};

// 3. Patch Console/EmitWarning as backup (for existing warnings)

// Check if the message matches the warning we want to suppress
const shouldSuppress = (args: any[]) => {
  if (args.length === 0) return false;

  const msg = args[0];

  // Check string messages
  if (typeof msg === 'string') {
    return msg.includes('TimeoutNegativeWarning') || msg.includes('Timeout duration was set to 1');
  }

  // Check Error objects
  if (msg instanceof Error) {
    return msg.name === 'TimeoutNegativeWarning' || msg.message.includes('TimeoutNegativeWarning');
  }

  return false;
};

// Override console.error
console.error = (...args: any[]) => {
  if (shouldSuppress(args)) return;
  originalConsoleError(...args);
};

// Override console.warn
console.warn = (...args: any[]) => {
  if (shouldSuppress(args)) return;
  originalConsoleWarn(...args);
};

// Override process.emitWarning
// @ts-ignore - process.emitWarning signature varies
process.emitWarning = (warning: string | Error, ...args: any[]) => {
  const warningMsg = typeof warning === 'string' ? warning : warning.message;
  const warningName = typeof warning === 'object' ? warning.name : args[0] || 'Warning';

  if (
    warningName === 'TimeoutNegativeWarning' ||
    warningMsg.includes('TimeoutNegativeWarning') ||
    warningMsg.includes('Timeout duration was set to 1')
  ) {
    return;
  }

  // @ts-ignore
  return originalEmitWarning(warning, ...args);
};

console.log('Applied Bun/KafkaJS compatibility patches');

export {};
