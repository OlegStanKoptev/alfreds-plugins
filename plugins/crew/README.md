# crew

**TL;DR:** subagents in three tiers, split by who makes the decisions, a
teamlead for a whole slice, and the orchestrator skill that runs a session
through them. Say "orchestrator mode" to start.

## Install

```bash
claude plugin marketplace add zienag/alfreds-plugins
```

```bash
claude plugin install crew@alfreds-plugins
```

## The crew

- `crew:solid`, the default worker: it chooses the route itself, and a wrong
  choice is cheap to catch.
- `crew:fast`: the brief has made every decision, the worker carries it out
  and stops when reality departs from the brief.
- `crew:deep`: being wrong is expensive; a design decision, a bug with no
  known cause, a review meant to find what is broken.
- `crew:codex`: a Haiku driver that hands the task to OpenAI Codex
  (`codex exec`), so the work runs on your ChatGPT plan. It is the default for
  spec'd implementation and review fix-ups, and gives second-opinion reviews.
  Claude still plans, verifies and reviews. Without `codex` installed and
  logged in, or when it hits a usage limit, the work goes to `crew:solid`.
  Set `CREW_CODEX_MODEL` to pick the Codex model.
- `crew:teamlead`: a sub-orchestrator for a slice too big for one task and
  too detailed for the lead's window; it delegates down the same way. It runs
  on Sonnet and hands design decisions to `crew:deep`; one teamlead per PR.

Review rounds stop once a round finds no high and no medium. Re-reviews and
fixes run on Codex, and a fresh `crew:deep` gives the final review only after
an earlier round found a high.

Every worker reports in one shape: the claim, the evidence, file paths for
anything long, what is open. Never a transcript.

## The skill

`crew:orchestrator` turns the session into the tech lead: it keeps judgment,
decomposition, verification and the conversation, and hands the hands-on work
to the crew. The skill folder also holds the harness facts about subagents
(what stalls them, what every brief must say) the lead and the teamlead read.
