import { describe, expect, it, mock } from 'bun:test';

describe('bun patches', () => {
  it('clamps negative timers and suppresses warnings', async () => {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;
    const originalEmitWarning = process.emitWarning;
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;

    const errorMock = mock((..._args: unknown[]) => undefined);
    const warnMock = mock((..._args: unknown[]) => undefined);
    const logMock = mock((..._args: unknown[]) => undefined);

    console.error = errorMock as unknown as typeof console.error;
    console.warn = warnMock as unknown as typeof console.warn;
    console.log = logMock as unknown as typeof console.log;

    const setTimeoutSpy = mock((...args: Parameters<typeof setTimeout>) =>
      originalSetTimeout(...args)
    );
    const setIntervalSpy = mock((...args: Parameters<typeof setInterval>) =>
      originalSetInterval(...args)
    );

    global.setTimeout = setTimeoutSpy as unknown as typeof setTimeout;
    global.setInterval = setIntervalSpy as unknown as typeof setInterval;

    await import('../../src/helpers/bun-patches');

    global.setTimeout(() => {}, -5);
    global.setInterval(() => {}, -10);

    const timeoutArgs = (setTimeoutSpy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      Parameters<typeof setTimeout>[0],
      number
    ];
    const intervalArgs = (setIntervalSpy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      Parameters<typeof setInterval>[0],
      number
    ];

    expect(timeoutArgs[1]).toBe(1);
    expect(intervalArgs[1]).toBe(1);

    errorMock.mockClear();
    console.error('TimeoutNegativeWarning');
    expect(errorMock).toHaveBeenCalledTimes(0);

    console.error('Other warning');
    expect(errorMock).toHaveBeenCalledTimes(1);

    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
    process.emitWarning = originalEmitWarning;
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
  });
});
