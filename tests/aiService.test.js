import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiService } from '../services/ai/aiService.js';

test('uses primary then fallback', async () => {
  const calls = [];
  const service = createAiService({
    primary: { summarize: async () => { calls.push('primary'); throw new Error('down'); } },
    fallback: { summarize: async () => { calls.push('fallback'); return 'ok'; } },
    logger: { warn() {} }
  });
  assert.equal(await service.summarize('x'), 'ok');
  assert.deepEqual(calls, ['primary', 'fallback']);
});

test('createEditorialBrief uses primary then fallback like other operations', async () => {
  const calls = [];
  const service = createAiService({
    primary: { createEditorialBrief: async () => { calls.push('primary'); throw new Error('down'); } },
    fallback: { createEditorialBrief: async () => { calls.push('fallback'); return '{}'; } },
    logger: { warn() {} }
  });
  assert.equal(await service.createEditorialBrief({ summary: 'x', strategy: 'viral_hook' }), '{}');
  assert.deepEqual(calls, ['primary', 'fallback']);
});
