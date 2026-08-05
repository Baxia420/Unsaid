import { Router } from 'express';
import { TurnRequestSchema } from './validation';
import { processTurnDetailed } from './service';
import { ModelAdapter } from '../adapters/ModelAdapter';

export function createTurnRouter(
  adapter: ModelAdapter,
  recoveryAdapter?: ModelAdapter,
  options?: { strictLive?: boolean }
): Router {
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

    const result = await processTurnDetailed(parsed.data, adapter, recoveryAdapter);

    const turn = parsed.data.turnIndex + 1;
    if (result.failureCategory) {
      console.log(`[UNSAID] turn=${turn} source=${result.source} status=${result.recoveryUsed ? 'recovered' : result.source === 'deterministic-fallback' ? 'fallback' : 'failed'} reason=${result.failureCategory} retryable=${result.retryable ?? false}`);
    } else {
      console.log(`[UNSAID] turn=${turn} source=${result.source} status=success latencyMs=${result.latencyMs ?? 0}`);
    }

    if (options?.strictLive && result.failureCategory && !result.recoveryUsed) {
      return res.status(503).json({
        error: 'The conversation service is temporarily unavailable. Please retry.',
      });
    }

    res.setHeader('X-Unsaid-Turn-Source', result.source);
    res.setHeader('X-Unsaid-Recovery-Used', String(result.recoveryUsed));
    return res.status(200).json(result.response);
  });

  return router;
}
