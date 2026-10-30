# Alfred's plugins for T3 Code

A provider-neutral adaptation of crew, caffeine and smart-compact. One shared source directory serves any T3 provider that can read project instructions and execute local shell commands. There is no model API, API key, dependency installation, timer, background daemon, or permanently resident process.

This is a portable edition, not a compatibility layer for Claude engine hooks. It does not claim identical behavior or verified support for every T3 provider.

## What works

- **Crew:** shared delegation roles, with providers/models discovered through T3's orchestration tools rather than hardcoded Claude agents. Requires delegation permission and T3 tool support.
- **Caffeine:** persist unfinished task metadata, return due reminders at explicit checkpoints, and clear completed tasks. T3 remains responsible for delegate notifications and process lifetimes. This edition cannot inject automatic reminders or block a provider's stop event.
- **Smart-compact:** save and retrieve a durable handover, including unfinished task metadata. Any model can read it. Native context compaction, context usage, and automatic resumption require host support and are not implemented by this bridge.

The original Claude plugins remain available under `../plugins`. They can still be used in Claude; these portable skills do not depend on those hooks being enabled. Avoid explicitly activating both orchestration skills for the same task; the host's instructions take priority.

## Set up a T3 project

Requires Node.js 20 or later. Keep this repository at a stable location. From its root:

```sh
node portable/install.mjs --project /absolute/path/to/your/project
```

The installer makes the portable skills the default when relevant in T3 sessions. Host and repository rules still control whether delegation is allowed. It adds a bounded instruction block to the project's `AGENTS.md` and `CLAUDE.md`. It preserves existing instructions, backs up changed files, and is idempotent. It references this checkout directly, so projects share one source without copying plugins. Moving the checkout requires reinstalling the references. Backup files have unique `.alfreds-t3-<id>.bak` suffixes; keep them local or remove them after reviewing the change.

Start a fresh T3 conversation in that project and ask it to read the project instructions. Providers that do not automatically load these files must be told to read them explicitly; this is not a globally registered T3 plugin. No running thread is reconfigured by the installer. Existing provider plugin settings are untouched.

Ask: “Use the portable crew skill to delegate this task” or “Save a portable handover for this thread.” Delegation must be authorized, and available model/provider choices come from T3. Background work uses the host's normal notifications, not a polling loop.

To remove just the managed blocks:

```sh
node portable/install.mjs --project /absolute/path/to/your/project --remove
```

## Bridge protocol

Run `node /absolute/path/to/alfreds-plugins/portable/bridge.mjs` with one JSON request on stdin. It returns one JSON result on stdout, errors on stderr with a nonzero exit code, and exits. It does not execute recorded commands or start an agent. The process is invoked only when needed.

Use the **actual T3 thread ID** as `session` for isolation. Another model continuing the same thread uses the same ID; a new thread can explicitly read the former thread's checkpoint by supplying its ID. IDs are hashed for safe directory names. A session ID is a namespace, not an authorization boundary; the local user can read all stored data.

Example (replace `your-t3-thread-id`):

```sh
node portable/bridge.mjs <<'JSON'
{"action":"track","session":"your-t3-thread-id","id":"real-host-task-id","description":"Run the project test suite","everyMs":300000}
JSON
```

Other requests:

```json
{"action":"capabilities"}
{"action":"status","session":"your-t3-thread-id"}
{"action":"due","session":"your-t3-thread-id"}
{"action":"finish","session":"your-t3-thread-id","id":"real-host-task-id"}
{"action":"checkpoint","session":"your-t3-thread-id","focus":"Continue the auth fix","handover":"Objective: fix login. Changed auth.mjs. Tests pending. Next: verify token refresh. No commits yet."}
{"action":"resume","session":"your-t3-thread-id"}
```

`due` returns reminders and advances their next due time; it does not poll task state. `finish` removes metadata only, without stopping a process. `checkpoint` accepts a focus of at most 280 characters and a handover of at most 100,000 characters; it retains all checkpoints. `resume` reads the latest checkpoint or the checkpoint identified by optional `id`, without consuming it. Neither operation changes model context. To resume after the host compacts, retrieve the checkpoint and continue; do not start a new top-level thread without the user's request.

State defaults to `~/.local/state/alfreds-t3/`, outside project checkouts. Override with `ALFREDS_T3_STATE_DIR`. Writes are atomic per session and serialized by a lock directory. Conflicting calls fail instead of losing changes. If a process crashes with the lock held, remove the session's `lock` directory only after confirming no bridge operation is running. State is plaintext with private permissions on newly created directories/files; omit credentials and unnecessary sensitive material. Remove a session's hashed directory when its history is no longer needed.

## Validation and scope

```sh
npm test --prefix portable
```

Tests cover persistent state across independent processes, task reminders and completion, session isolation, checkpoint recovery, input validation, locking, and reversible instruction installation. No provider session or paid model is started by tests. Host-level behavior (delegation, automatic instruction loading, native compaction) needs verification in each chosen provider; this release does not claim that validation.

The existing fork is `OlegStanKoptev/alfreds-plugins`, based on `zienag/alfreds-plugins`. The portable edition is maintained on the fork’s `main` branch; source changes do not install into other projects automatically.
