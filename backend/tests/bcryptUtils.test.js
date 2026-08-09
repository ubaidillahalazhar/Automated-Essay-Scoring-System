const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, comparePassword } = require('../src/utils/bcryptUtils');

test('comparePassword accepts legacy plain-text stored passwords', async () => {
  const storedPassword = 'plainPassword123';
  assert.equal(await comparePassword('plainPassword123', storedPassword), true);
});

test('comparePassword works for bcrypt hashes', async () => {
  const hashed = await hashPassword('secret123');
  assert.equal(await comparePassword('secret123', hashed), true);
  assert.equal(await comparePassword('wrongpassword', hashed), false);
});
