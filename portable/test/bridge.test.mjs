import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { execute } from '../bridge.mjs';
import { install, mergeInstructions, managedInstructions } from '../install.mjs';
const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'alfreds-t3-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const call = (action, values = {}, now = 0) => execute({ session: 'thread-a', action, ...values }, root, now);
  return { root, call };
};
test('reminders become due, rearm, persist and finish', t => {
  const { call } = fixture(t);
  call('track', { id: 'task-1', description: 'build', everyMs: 1000 });
  assert.deepEqual(call('due', {}, 999), []);
  assert.equal(call('due', {}, 1000)[0].elapsedMs, 1000);
  assert.deepEqual(call('due', {}, 1000), []);
  assert.equal(call('status').tasks.length, 1);
  call('finish', { id: 'task-1' });
  assert.deepEqual(call('due', {}, 3000), []);
});
test('session IDs isolate work and cannot escape the state directory', t => {
  const { call, root } = fixture(t);
  call('track', { id: 'task', description: 'a' });
  assert.deepEqual(call('status', { session: '../../thread-b' }).tasks, []);
  assert.equal(readdirSync(root).length, 2);
  assert.ok(readdirSync(root).every(name => /^[a-f0-9]{64}$/.test(name)));
});
test('checkpoint preserves pending tasks and resumes repeatedly without claiming compaction', t => {
  const { call } = fixture(t);
  call('track', { id: 'shell-1', description: 'tests' });
  const saved = call('checkpoint', { focus: 'Fix auth', handover: 'Changed auth.mjs; test pending.' });
  assert.equal(saved.nativeCompactionPerformed, false);
  assert.equal(saved.pendingTasks[0].id, 'shell-1');
  assert.equal(call('resume').focus, 'Fix auth');
  assert.equal(call('resume', { id: saved.id }).handover, saved.handover);
  assert.equal(call('status').checkpointCount, 1);
});
test('invalid requests leave state usable and release the lock', t => {
  const { call } = fixture(t);
  assert.throws(() => call('checkpoint', { focus: 'x'.repeat(281), handover: 'x' }), /focus/);
  assert.throws(() => call('track', { id: 'x', description: 'x', everyMs: -1 }), /everyMs/);
  assert.throws(() => call('finish', { id: 'unknown' }), /Unknown task/);
  assert.throws(() => call('bogus'), /Unknown action/);
  assert.throws(() => call('resume'), /No matching/);
  assert.equal(call('status').tasks.length, 0);
});
test('duplicate IDs cannot silently overwrite a pending task', t => {
  const { call } = fixture(t);
  call('track', { id: 'task', description: 'original' });
  assert.throws(() => call('track', { id: 'task', description: 'replacement' }), /already tracked/);
  assert.equal(call('status').tasks[0].description, 'original');
});
test('special object property IDs survive serialization safely', t => {
  const { call } = fixture(t);
  call('track', { id: '__proto__', description: 'safe' });
  assert.equal(call('status').tasks[0].id, '__proto__');
  call('finish', { id: '__proto__' });
  assert.equal(call('status').tasks.length, 0);
});
test('existing lock is respected, not removed by another caller', t => {
  const { call, root } = fixture(t);
  call('status');
  const lock = join(root, readdirSync(root)[0], 'lock');
  mkdirSync(lock);
  assert.throws(() => call('status'), /locked/);
  assert.deepEqual(readdirSync(lock), []);
});
test('capabilities disclose unavailable host features', () => {
  const result = execute({ action: 'capabilities' });
  assert.match(result.compaction, /does not compact/);
  assert.match(result.reminders, /no autonomous/);
});
test('CLI supports fresh independent process state and returns structured errors', t => {
  const { root } = fixture(t);
  const cli = input => spawnSync(process.execPath, ['bridge.mjs'], { cwd: new URL('..', import.meta.url), input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ALFREDS_T3_STATE_DIR: root } });
  assert.equal(cli({ session: 'cli', action: 'checkpoint', focus: 'continue', handover: 'next step' }).status, 0);
  const resumed = cli({ session: 'cli', action: 'resume' });
  assert.equal(JSON.parse(resumed.stdout).result.handover, 'next step');
  const bad = cli({ action: 'track' });
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.equal(JSON.parse(bad.stderr).ok, false);
});
test('installer preserves repository rules, is idempotent, and uninstalls only its block', t => {
  const { root } = fixture(t);
  writeFileSync(join(root, 'CLAUDE.md'), '# Rules\nDo not push.\n');
  const result = install(root);
  assert.equal(result.files.length, 2);
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /Do not push/);
  assert.deepEqual(install(root).files, []);
  install(root, { remove: true });
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /Do not push/);
  assert.doesNotMatch(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /alfreds-t3:start/);
});
test('installer rejects malformed blocks and symlinks before editing any file', t => {
  const { root } = fixture(t);
  assert.throws(() => mergeInstructions('<!-- alfreds-t3:start -->', managedInstructions('/source')), /Malformed/);
  writeFileSync(join(root, 'other.md'), 'private');
  symlinkSync(join(root, 'other.md'), join(root, 'CLAUDE.md'));
  assert.throws(() => install(root), /non-regular/);
  assert.equal(readFileSync(join(root, 'other.md'), 'utf8'), 'private');
  assert.deepEqual(readdirSync(root).sort(), ['CLAUDE.md', 'other.md']);
});
