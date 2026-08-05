import type { Express } from 'express';
import type { Server } from 'http';

export interface StartServerOptions {
  app: Express;
  port: number;
}

/**
 * Starts the Express app on the given port and returns the http.Server handle.
 * Sets up error handling for EADDRINUSE and other listen errors.
 * Sets up graceful shutdown on SIGINT and SIGTERM.
 */
export function startServer({ app, port }: StartServerOptions): Server {
  const server = app.listen(port, () => {
    console.log(`[UNSAID] Server running on http://localhost:${port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[UNSAID] Port ${port} is already in use.`);
      process.exitCode = 1;
    } else {
      console.error(`[UNSAID] Server error: ${err.message}`);
      process.exitCode = 1;
    }
  });

  const shutdown = createShutdownHandler(server);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

/**
 * Creates a shutdown handler that closes the server exactly once.
 * Prevents duplicate close calls from multiple signals.
 */
export function createShutdownHandler(server: Server): () => void {
  let closing = false;
  return () => {
    if (closing) return;
    closing = true;
    console.log('[UNSAID] Shutting down…');
    server.close(() => {
      console.log('[UNSAID] Server stopped.');
    });
  };
}
