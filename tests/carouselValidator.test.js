import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCarousel } from '../validators/carousel.js';

const slides = [
  ['hook', 'Hook'], ['context', 'Context'], ['value', 'Value 1'], ['value', 'Value 2'], ['takeaway', 'Takeaway'], ['cta', 'CTA']
].map(([type, heading]) => ({ type, heading, body: 'Body' }));
const valid = { title: 'Title', summary: 'Summary', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1', slides, captionIdeas: ['Caption one', 'Caption two'], hashtags: ['#tag1', '#tag2'] };

test('accepts exactly six ordered slides', () => assert.equal(validateCarousel(valid).success, true));
test('rejects wrong count and order', () => {
  assert.equal(validateCarousel({ ...valid, slides: slides.slice(0, 5) }).success, false);
  assert.equal(validateCarousel({ ...valid, slides: [slides[1], ...slides.slice(1)] }).success, false);
});
test('rejects unsupported values', () => assert.equal(validateCarousel({ ...valid, strategy: 'other' }).success, false));
