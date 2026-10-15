/** A shell the model left in the background, tracked until it ends or is stopped. */
export type Task = {
  id: string
  command: string
  description: string
  /** The file its output goes to; null when the tool result named none. */
  output: string | null
  /** When the command started, in milliseconds. */
  startedAt: number
  /** When the next reminder is due, in milliseconds. */
  remindAt: number
  /** The subagent whose loop runs it; null for the main conversation. */
  agentId: string | null
  /** The subagent that started it, once its loop has ended and the task passed to the main conversation. */
  parent: string | null
  /** True when the engine ends the shell with its caller's final response, so it cannot outlive the subagent. */
  endsWithCaller: boolean
}

export type Tasks = Record<string, Task>

declare module 'claude-code' {
  interface PluginState {
    'task-reminder': {
      tasks: Tasks
    }
  }
}
