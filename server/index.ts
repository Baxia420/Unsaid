import express, { ErrorRequestHandler } from 'express';
import { createTurnRouter } from './turn/route.ts';
import {
  createModelAdapter,
  createRecoveryAdapter,
  getRuntimeMode,
  getLiveRecovery,
} from './adapters/factory.ts';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'Invalid request',
      details: [
        {
          path: [],
          message: 'Malformed JSON body',
        },
      ],
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
  });
};

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const adapter = createModelAdapter();
  const recoveryAdapter = createRecoveryAdapter();
  const mode = getRuntimeMode();
  const recovery = getLiveRecovery();
  const keyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  console.log(`[UNSAID] AI runtime: mode=${mode} model=${model} keyConfigured=${keyConfigured} recovery=${recovery}`);

  app.get(['/api/status', '/status', '/'], (_req, res) => {
    res.json({
      aiMode: mode,
      recoveryMode: recovery,
    });
  });
  app.use(['/api/turn', '/turn'], createTurnRouter(adapter, recoveryAdapter, { strictLive: mode === 'live' && recovery === 'none' }));
  app.use('/', createTurnRouter(adapter, recoveryAdapter, { strictLive: mode === 'live' && recovery === 'none' }));

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not found',
    });
  });

  app.use(errorHandler);

  return app;
}
