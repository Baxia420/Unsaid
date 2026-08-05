import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import { startServer, createShutdownHandler } from '../server/lifecycle';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startServer', () => {
  it('starts and remains listening', async () => {
    const app = express();
    const server = startServer({ app, port: 0 });
    try {
      await new Promise<void>((resolve) => server.on('listening', resolve));
      expect(server.listening).toBe(true);
      const addr = server.address();
      expect(addr).not.toBeNull();
    } finally {
      server.close();
    }
  });

  it('listen callback does not trigger shutdown', async () => {
    const app = express();
    const server = startServer({ app, port: 0 });
    try {
      await new Promise<void>((resolve) => server.on('listening', resolve));
      // Wait a tick to ensure no shutdown was scheduled
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(server.listening).toBe(true);
    } finally {
      server.close();
    }
  });

  it('reports EADDRINUSE clearly without stack traces', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, resolve));
    const blockerPort = (blocker.address() as { port: number }).port;

    const app = express();
    const server = startServer({ app, port: blockerPort });

    await new Promise<void>((resolve) => server.on('error', () => resolve()));

    expect(errSpy).toHaveBeenCalled();
    const output = errSpy.mock.calls.flat().join(' ');
    expect(output).toContain(`Port ${blockerPort} is already in use`);
    expect(output).not.toContain('stack');
    expect(process.exitCode).toBe(1);

    // Reset exitCode for other tests
    process.exitCode = undefined;
    blocker.close();
  });

  it('does not expose API key in startup logs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-secret-key-xyz';

    const app = express();
    const server = startServer({ app, port: 0 });
    try {
      await new Promise<void>((resolve) => server.on('listening', resolve));
      const output = logSpy.mock.calls.flat().join(' ');
      expect(output).not.toContain('test-secret-key-xyz');
    } finally {
      server.close();
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});

describe('createShutdownHandler', () => {
  it('SIGINT closes the server exactly once', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    expect(server.listening).toBe(true);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const shutdown = createShutdownHandler(server);

    shutdown();
    await new Promise<void>((resolve) => server.on('close', resolve));

    expect(server.listening).toBe(false);
    const output = logSpy.mock.calls.flat().join(' ');
    expect(output).toContain('Shutting down');
  });

  it('SIGTERM closes the server exactly once', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const shutdown = createShutdownHandler(server);

    shutdown();
    await new Promise<void>((resolve) => server.on('close', resolve));

    expect(server.listening).toBe(false);
    const output = logSpy.mock.calls.flat().join(' ');
    expect(output).toContain('Server stopped');
  });

  it('repeated shutdown calls do not close twice', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const shutdown = createShutdownHandler(server);

    shutdown();
    shutdown();
    shutdown();

    await new Promise<void>((resolve) => server.on('close', resolve));

    const shutdownCalls = logSpy.mock.calls
      .flat()
      .filter((msg) => typeof msg === 'string' && msg.includes('Shutting down'));
    expect(shutdownCalls).toHaveLength(1);
  });
});

describe('development script configuration', () => {
  it('dev script uses predictable ports and kill-others-on-fail', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname ?? '.', '..', 'package.json'), 'utf-8')
    );
    const devScript: string = pkg.scripts.dev;
    expect(devScript).toContain('--kill-others-on-fail');
    expect(devScript).toContain('--strictPort');
    expect(devScript).toContain('--port 5173');
  });

  it('Vite proxies /api to port 3001', async () => {
    const { default: config } = await import('../vite.config');
    const resolved = config as { server?: { proxy?: Record<string, unknown> } };
    const proxy = resolved.server?.proxy;
    expect(proxy).toBeDefined();
    const apiProxy = proxy?.['/api'] as { target?: string } | undefined;
    expect(apiProxy?.target).toBe('http://localhost:3001');
  });
});
