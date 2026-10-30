# alfreds-plugins

Claude Code mods, with a [provider-neutral T3 Code edition](portable/README.md).

The original Claude plugins remain under `plugins/`. The portable edition uses T3 delegation, cooperative task tracking, and durable handovers; it does not load Claude engine hooks in other providers.

```bash
claude plugin marketplace add zienag/alfreds-plugins
```

| Plugin | What it does |
| --- | --- |
| [smart-compact](plugins/smart-compact) | The agent compacts its own context between tasks, with a focus it writes for the compactor, and carries on by itself. |
| [crew](plugins/crew) | Subagents in three tiers, split by who makes the decisions, a teamlead for a whole slice, and the orchestrator skill that runs a session through them. |
| [caffeine](plugins/caffeine) | Things that keep agents from falling asleep: reminders of every shell left in the background, and a foreground subagent held from ending its turn while a command the engine would kill with it still runs. |

```bash
claude plugin install smart-compact@alfreds-plugins
```

```bash
claude plugin install crew@alfreds-plugins
```

```bash
claude plugin install caffeine@alfreds-plugins
```
