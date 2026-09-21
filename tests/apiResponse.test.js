import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'node:http';
import { createApp } from '../app.js';

test('unknown route returns safe error envelope', async () => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/missing`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.deepEqual(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
  server.close();
});
