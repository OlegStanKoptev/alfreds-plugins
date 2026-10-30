---
name: t3-crew
description: Provider-neutral delegation roles for T3 Code. Use for T3 delegation and orchestration when relevant, including crew mode and delegated implementation or review.
---

Use the current host's T3 tools. Tool names may have a namespace prefix. Host and user instructions take priority. This skill never grants permission to delegate, push, merge, or send messages.

1. Confirm delegation is authorized. Call orchestrator_capabilities once before the first delegate_task; use actual returned providers, models and options. Never substitute an unavailable requested model.
2. Choose roles by task, not by model brand: fast executes a complete brief; solid decides routine implementation details; deep investigates uncertain or expensive decisions; teamlead owns a bounded slice only when nested delegation is explicitly authorized. Do not hardcode Claude model names or run codex exec.
3. For T3-managed work use delegate_task, not a new top-level thread. Include the objective, relevant paths, constraints, expected validation, deliverables, and whether any further delegation is allowed. A brief must stand alone. Select settings through target.options according to the current tool schema. Honor host instructions that call for native delegation instead.
4. Follow the delegate's returned next instruction. Do not poll, sleep, or start watchers for a running delegate. Cancel superseded work with task_cancel. Read completed results, inspect the actual diff, and validate material claims.
5. Request each fresh review as a new delegate_task. Fix small findings yourself. Respect repository commit and push rules, and T3's PR linking and watch lifecycle.

Report the claim, evidence, changed paths, and unresolved risks. For PR work follow the host's required final reporting shape. If delegation is unavailable, perform the task in the current session and report that limitation.
