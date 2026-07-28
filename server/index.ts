import express from 'express';
import { createTurnRouter } from './turn/route';
import { MockModelAdapter } from './adapters/MockModelAdapter';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const adapter = new MockModelAdapter('valid');
  app.use('/api/turn', createTurnRouter(adapter));

  return app;
}
