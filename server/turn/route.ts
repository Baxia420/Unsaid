import { Router } from 'express';
import { TurnRequestSchema } from './validation';
import { processTurn } from './service';
import { ModelAdapter } from '../adapters/ModelAdapter';

export function createTurnRouter(adapter: ModelAdapter): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = TurnRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    const response = await processTurn(parsed.data, adapter);
    return res.status(200).json(response);
  });

  return router;
}
