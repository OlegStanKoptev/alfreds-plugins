---
name: t3-smart-compact
description: Save a durable provider-neutral handover before a long task or context transition; use native compaction only when the host exposes it.
---

The bridge CLI in ../../README.md saves a checkpoint; it does not compact the model's context or launch a new thread. Use the actual T3 thread ID as session.

At a meaningful task boundary, or when the host reports context pressure, save a checkpoint with a short focus (maximum 280 characters) and a factual handover: user objective, accepted constraints, completed work, evidence and validation, touched paths, unfinished tasks and their IDs, rejected approaches, and the next concrete step. Exclude credentials and private data that is not needed for continuation.

Only call native compaction if an actual supported host tool exposes it. Do not invent a compact tool, context-token count, or universal token threshold. Do not create a new top-level thread unless the user requested one. Automatic host compaction remains under host control.

After a context transition, use resume with the previous session ID to retrieve the latest checkpoint, verify current files and task state, then continue. Checkpoints are retained, so repeated resume calls are safe. A checkpoint alone is not grounds to end an active user task. Report whether you saved a handover or actually performed native compaction accurately.
