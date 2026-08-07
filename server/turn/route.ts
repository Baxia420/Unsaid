import { Router } from 'express';
import { TurnRequestSchema } from './validation.ts';
import { processTurnDetailed, RecoverableTurnError } from './service.ts';
import { ModelAdapter } from '../adapters/ModelAdapter.ts';

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

    let result;
    try {
      result = await processTurnDetailed(parsed.data, adapter, recoveryAdapter);
    } catch (error) {
      if (error instanceof RecoverableTurnError) {
        console.log(`[UNSAID] turn=${parsed.data.turnIndex + 1} source=provider status=rejected reason=${error.code} retryable=true`);
        return res.status(422).json({
          error: error.message,
          code: error.code,
          retryable: true,
        });
      }
      throw error;
    }

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
    res.setHeader('X-Unsaid-Latency-Ms', String(result.latencyMs ?? 0));
    return res.status(200).json(result.response);
  });

  return router;
}
