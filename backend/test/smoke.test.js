import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server.js';

test('backend exposes ping and auth endpoints', async () => {
  const app = createApp();
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const ping = await fetch(`http://127.0.0.1:${port}/api/ping`);
  const pingBody = await ping.json();
  assert.equal(ping.status, 200);
  assert.equal(pingBody.ok, true);

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@lumen.gov', password: 'lumen123' }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 200);
  assert.ok(loginBody.access_token);

  server.close();
});
