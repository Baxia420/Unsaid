import express, { ErrorRequestHandler } from 'express';
import { createTurnRouter } from './turn/route';
import { createModelAdapter } from './adapters/factory';

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
  app.use('/api/turn', createTurnRouter(adapter));

  app.use(errorHandler);

  return app;
}
