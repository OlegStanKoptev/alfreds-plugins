#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, lstatSync, statSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const START = '<!-- alfreds-t3:start -->';
const END = '<!-- alfreds-t3:end -->';
export function managedInstructions(source) {
  return `${START}
## Alfred's portable T3 plugins

Shared source: ${JSON.stringify(source)}. These are instructions and a local CLI, not Claude hooks.
In T3 sessions, use these portable skills by default whenever relevant. For delegation and orchestration, read ${JSON.stringify(join(source, 'skills/t3-crew/SKILL.md'))}.
For unfinished background work read ${JSON.stringify(join(source, 'skills/t3-caffeine/SKILL.md'))}.
For context handovers read ${JSON.stringify(join(source, 'skills/t3-smart-compact/SKILL.md'))}.
Read ${JSON.stringify(join(source, 'README.md'))} before using the bridge CLI.
User, host, and repository rules take priority. This does not authorize delegation, commits, pushes, or new threads.
${END}`;
}
export function mergeInstructions(original, block) {
  const start = original.indexOf(START), end = original.indexOf(END);
  if ((start === -1) !== (end === -1) || (end !== -1 && end < start) || original.indexOf(START, start + START.length) !== -1 || original.indexOf(END, end + END.length) !== -1)
    throw new Error('Malformed or duplicate managed block; refusing to edit');
  if (start !== -1) return original.slice(0, start) + block + original.slice(end + END.length);
  return block ? original + (original.endsWith('\n') || original === '' ? '\n' : '\n\n') + block + '\n' : original;
}
export function install(project, { remove = false, source = dirname(fileURLToPath(import.meta.url)) } = {}) {
  project = resolve(project);
  if (!statSync(project).isDirectory()) throw new Error('Project must be an existing directory');
  const block = remove ? '' : managedInstructions(source);
  // Validate both files before changing either.
  const edits = ['AGENTS.md', 'CLAUDE.md'].map(name => {
    const path = join(project, name);
    let info;
    try { info = lstatSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error(`Refusing non-regular instruction file: ${path}`);
    const original = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return { path, original, next: mergeInstructions(original, block) };
  });
  for (const { path, original, next } of edits) {
    if (original === next) continue;
    if (existsSync(path)) writeFileSync(`${path}.alfreds-t3-${randomUUID()}.bak`, original, { mode: 0o600, flag: 'wx' });
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, next, { mode: existsSync(path) ? statSync(path).mode & 0o777 : 0o644, flag: 'wx' });
      renameSync(temp, path);
    } finally { rmSync(temp, { force: true }); }
  }
  return { project, files: edits.filter(x => x.original !== x.next).map(x => x.path), removed: remove };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--project' || !args[1] || args.slice(2).some(x => x !== '--remove') || args.length > 3)
      throw new Error('Usage: node portable/install.mjs --project /absolute/project [--remove]');
    console.log(JSON.stringify(install(args[1], { remove: args.includes('--remove') })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
