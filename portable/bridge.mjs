#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const text = (value, name, max = 20000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${name} must be nonempty text, at most ${max} characters`);
  return value.trim();
};
export const capabilities = Object.freeze({
  delegation: 'T3 delegate_task; subject to user authorization and provider availability',
  reminders: 'explicit due checks; no autonomous timer or prompt injection',
  backgroundExecution: 'owned by T3 or the provider; this bridge records metadata only',
  compaction: 'durable handover only; does not compact or resume a provider session',
});

/** One durable state per T3 thread. No command execution, provider API, or secrets. */
export function execute(request, root = join(homedir(), '.local', 'state', 'alfreds-t3'), now = Date.now()) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Expected a JSON object');
  if (request.action === 'capabilities') return capabilities;
  const session = text(request.session, 'session', 200);
  const dir = join(resolve(root), hash(session));
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, 'lock');
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Session state is locked; retry after the current operation. After a crash, remove the stale lock directory only when no bridge operation is running.');
    throw error;
  }
  let temp;
  try {
    const file = join(dir, 'state.json');
    const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, session, tasks: {}, checkpoints: [] };
    if (state.version !== 1 || state.session !== session) throw new Error('Unsupported or mismatched session state');
    let result;
    let changed = false;
    switch (request.action) {
      case 'track': {
        const id = text(request.id, 'id', 300);
        if (Object.hasOwn(state.tasks, id)) throw new Error('Task already tracked; finish it before reusing its ID');
        const everyMs = request.everyMs ?? 300000;
        if (!Number.isSafeInteger(everyMs) || everyMs < 1000) throw new Error('everyMs must be an integer >= 1000');
        const task = { id, description: text(request.description, 'description', 2000), startedAt: now, remindAt: now + everyMs, everyMs };
        Object.defineProperty(state.tasks, id, { value: task, enumerable: true, writable: true, configurable: true });
        result = task; changed = true; break;
      }
      case 'due': {
        result = Object.values(state.tasks).filter(task => task.remindAt <= now).map(task => ({ ...task, elapsedMs: now - task.startedAt }));
        for (const task of result) state.tasks[task.id].remindAt = now + task.everyMs;
        changed = result.length > 0; break;
      }
      case 'finish': {
        const id = text(request.id, 'id', 300);
        if (!Object.hasOwn(state.tasks, id)) throw new Error('Unknown task ID');
        delete state.tasks[id]; result = { finished: id }; changed = true; break;
      }
      case 'checkpoint': {
        const focus = text(request.focus, 'focus', 280);
        const handover = text(request.handover, 'handover', 100000);
        const checkpoint = { id: randomUUID(), createdAt: now, focus, handover };
        state.checkpoints.push(checkpoint);
        result = { ...checkpoint, pendingTasks: Object.values(state.tasks), nativeCompactionPerformed: false };
        changed = true; break;
      }
      case 'resume': {
        const checkpoint = request.id === undefined ? state.checkpoints.at(-1) : state.checkpoints.find(item => item.id === request.id);
        if (!checkpoint) throw new Error('No matching checkpoint');
        result = { ...checkpoint, pendingTasks: Object.values(state.tasks), instruction: 'Read the handover, verify current workspace state, and continue the stated focus.' }; break;
      }
      case 'status': result = { session, tasks: Object.values(state.tasks), checkpointCount: state.checkpoints.length }; break;
      default: throw new Error('Unknown action; use capabilities, track, due, finish, checkpoint, resume, or status');
    }
    if (changed) {
      temp = join(dir, `${randomUUID()}.tmp`);
      writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temp, file);
    }
    return result;
  } finally {
    if (temp) rmSync(temp, { force: true });
    rmSync(lock, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const input = readFileSync(0, 'utf8');
    if (input.length > 200000) throw new Error('Request exceeds 200000 characters');
    const result = execute(JSON.parse(input), process.env.ALFREDS_T3_STATE_DIR);
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
