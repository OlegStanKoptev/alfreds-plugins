import type { EngineInterface, Register } from 'claude-code'
import { update } from 'claude-code'

import type { Task } from '../types'
import {
  MINUTE, type Output, type Schedule, firstReminder, hasExited, holdReason, nextReminder, outputPath, reminder, schedule, squash, tailOf,
  taskId, toastText,
} from './reminders'

const tasks = { plugin: 'caffeine', key: 'tasks' } as const
const READ_LIMIT = 4 * 1024 * 1024

/** Whether the main loop is inside a turn, and whether a reminder pass is under way; both start over on a reload. */
const loop = { running: false, ticking: false }

export const register: Register = (on, options) => {
  const plan = schedule(options.marks, options.every)
  let tick: { cancel: () => void } | null = null

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    loop.running = false
    tick?.cancel()
    tick = $.clock.every(MINUTE, () => void remind($, plan))
    return started
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) loop.running = true
    return yield* next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const id = ran.result.backgroundTaskId
    if (id === undefined) return ran
    const now = await $.clock.now()
    const startedAt = now - (ran.result.timedOutAfterMs ?? 0)
    const task: Task = {
      id,
      command: squash(e.command),
      description: squash(e.description ?? ''),
      output: outputPath(ran.text ?? ''),
      startedAt,
      remindAt: nextReminder(startedAt, now, plan),
      agentId: e.agentId ?? null,
      parent: null,
      endsWithCaller: ran.result.backgroundEndsWithFinalResponse === true,
      held: false,
    }
    await update($, tasks, (all = {}) => ({ ...all, [id]: task }))
    return { ...ran, context: [...(ran.context ?? []), firstReminder(task, now, plan)] }
  })

  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const id = e.task_id ?? e.shell_id
    if (id !== undefined) await forget($, id)
    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') {
      const id = taskId(e.text)
      if (id !== null) await forget($, id)
    }
    return next(e)
  })

  on('classic.SubagentStop', async ($, e, next) => {
    const stopped = await next(e)
    if (stopped.block !== undefined) return stopped
    const { value: all = {} } = await $.state.get(tasks)
    const held: Task[] = []
    for (const task of Object.values(all)) {
      if (task.agentId !== e.agent_id || task.held || !task.endsWithCaller) continue
      if (!(await outputOf($, task.output))?.done) held.push(task)
    }
    if (held.length === 0) return stopped
    const ids = new Set(held.map(task => task.id))
    await update($, tasks, (cur = {}) => Object.fromEntries(
      Object.values(cur).map(task => [task.id, ids.has(task.id) ? { ...task, held: true } : task]),
    ))
    return { ...stopped, block: holdReason(held) }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      loop.running = false
      return done
    }
    const ended = e.agentId
    const { value: before = {} } = await $.state.get(tasks)
    const finished = new Set<string>()
    for (const task of Object.values(before)) {
      if (task.agentId === ended && (await outputOf($, task.output))?.done) finished.add(task.id)
    }
    await update($, tasks, (all = {}) => Object.fromEntries(
      Object.values(all)
        .filter(task => task.agentId !== ended || !(task.endsWithCaller || finished.has(task.id)))
        .map(task => [task.id, task]),
    ))
    return done
  })
}

/** Sends every due reminder, one pass at a time. */
async function remind($: EngineInterface, plan: Schedule): Promise<void> {
  if (loop.ticking) return
  loop.ticking = true
  try {
    const now = await $.clock.now()
    const { value: all = {} } = await $.state.get(tasks)
    for (const task of Object.values(all)) {
      if (task.remindAt > now) continue
      const output = await outputOf($, task.output)
      if (output?.done) {
        await forget($, task.id)
        continue
      }
      let owner = task.agentId
      if (owner !== null && !(await toAgent($, reminder(task, now, output, plan), owner))) owner = null
      const sent = owner === null ? { ...task, agentId: null, parent: task.parent ?? task.agentId } : task
      if (owner === null) {
        await toMain($, reminder(sent, now, output, plan))
        if (!loop.running) $.ui.toast(toastText(sent, now))
      }
      const remindAt = nextReminder(task.startedAt, now, plan)
      await update($, tasks, (cur = {}) => cur[task.id] === undefined ? cur : { ...cur, [task.id]: { ...sent, remindAt } })
    }
  } finally {
    loop.ticking = false
  }
}

async function forget($: EngineInterface, id: string): Promise<void> {
  await update($, tasks, (all = {}) => {
    const { [id]: _, ...rest } = all
    return rest
  })
}

/** What the output file says now: its size, when it last changed, its tail when it is small enough to read. */
async function outputOf($: EngineInterface, path: string | null): Promise<Output | null> {
  if (path === null) return null
  let stat
  try {
    stat = await $.fs.stat(path)
  } catch {
    return null
  }
  const text = stat.size > 0 && stat.size <= READ_LIMIT ? String(await $.fs.read(path)) : ''
  return { size: stat.size, mtimeMs: stat.mtimeMs, tail: tailOf(text), done: hasExited(text) }
}

/** Appends the text to a subagent's conversation; false when its loop no longer runs. */
async function toAgent($: EngineInterface, text: string, agentId: string): Promise<boolean> {
  try {
    const stored = await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] }, agentId })
    return stored.deny === undefined
  } catch {
    return false
  }
}

/** Appends the text into the running turn, or wakes an idle session with it as a prompt. */
async function toMain($: EngineInterface, text: string): Promise<void> {
  if (loop.running) {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
    return
  }
  $.prompt.submit({ text }).catch(() => undefined)
}
