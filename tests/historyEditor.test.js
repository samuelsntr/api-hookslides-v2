import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryController } from '../controllers/historyController.js';
import { editorUpdateSchema } from '../validators/requests.js';

const slides = ['hook', 'context', 'value', 'value', 'takeaway', 'cta'].map((type, index) => ({ type, heading: `Heading ${index}`, body: `Body ${index}` }));

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('editor request schema preserves the six-slide contract', () => {
  assert.equal(editorUpdateSchema.safeParse({ slides, expectedRevision: 1 }).success, true);
  assert.equal(editorUpdateSchema.safeParse({ slides: slides.slice(0, 5), expectedRevision: 1 }).success, false);
  assert.equal(editorUpdateSchema.safeParse({ slides: slides.map((slide, index) => index === 0 ? { ...slide, type: 'cta' } : slide), expectedRevision: 1 }).success, false);
});

test('free users are denied editor data by the server', () => {
  const controller = createHistoryController({ findCarouselById: () => ({ id: 'carousel' }) });
  let rejected;
  controller.getEditor({ params: { id: 'carousel' }, user: { id: 'free-user', plan: 'free' } }, responseRecorder(), (error) => { rejected = error; });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.code, 'FEATURE_NOT_AVAILABLE');
});

test('Creator can load and update only an owned carousel', () => {
  const item = { id: 'carousel', revision: 1, slides };
  const repository = {
    findCarouselById: (id, userId) => id === 'carousel' && userId === 'creator-user' ? item : null,
    updateCarouselSlides: ({ userId }) => userId === 'creator-user' ? { ...item, revision: 2 } : null,
  };
  const controller = createHistoryController(repository);
  const readResponse = responseRecorder();
  controller.getEditor({ params: { id: 'carousel' }, user: { id: 'creator-user', plan: 'creator' } }, readResponse, (error) => { throw error; });
  assert.equal(readResponse.statusCode, 200);

  const updateResponse = responseRecorder();
  controller.updateEditor({ params: { id: 'carousel' }, body: { slides, expectedRevision: 1 }, user: { id: 'creator-user', plan: 'creator' } }, updateResponse, (error) => { throw error; });
  assert.equal(updateResponse.body.data.revision, 2);

  let rejected;
  controller.getEditor({ params: { id: 'carousel' }, user: { id: 'different-user', plan: 'pro' } }, responseRecorder(), (error) => { rejected = error; });
  assert.equal(rejected.status, 404);
});
