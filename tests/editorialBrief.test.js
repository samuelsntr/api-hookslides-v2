import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEditorialBrief } from '../validators/editorialBrief.js';

const validBrief = {
  coreIdea: 'One clear idea',
  audienceProblem: 'A relatable problem',
  promise: 'What the viewer gets',
  angle: 'A specific non-generic angle',
  keyInsights: ['Insight one', 'Insight two'],
  evidence: ['Source fact one'],
  emotionalShift: 'from confused to confident',
  slidePlan: ['hook purpose', 'context purpose', 'value1 purpose', 'value2 purpose', 'takeaway purpose', 'cta purpose'],
  ctaDirection: 'Share with a friend'
};

test('accepts a well-formed brief', () => {
  assert.equal(validateEditorialBrief(validBrief).success, true);
});

test('rejects a brief with wrong slidePlan length', () => {
  assert.equal(validateEditorialBrief({ ...validBrief, slidePlan: validBrief.slidePlan.slice(0, 5) }).success, false);
});

test('rejects a brief missing required fields', () => {
  const { coreIdea, ...rest } = validBrief;
  assert.equal(validateEditorialBrief(rest).success, false);
});

test('rejects an empty keyInsights array', () => {
  assert.equal(validateEditorialBrief({ ...validBrief, keyInsights: [] }).success, false);
});
