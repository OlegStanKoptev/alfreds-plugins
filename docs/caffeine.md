# caffeine: engine facts the design rests on

Working notes for whoever changes the mod. Each fact names how it was checked
and on which Claude Code build; recheck on a build that changes the hooks API.

## How 0.0.1 was checked

The mod was called task-reminder then; the quotes below carry that name.

Headless runs of the app's 2.1.295 binary on `claude-opus-5-5`, as
`docs/smart-compact.md` describes, with `--plugin-dir plugins/caffeine`,
`--debug-file` for the engine's log, and the options passed as
`--settings '{"pluginConfigs":{"caffeine":{"options":{"marks":"1 2 3","every":1}}}}'`
(the values sit under `options`; a value put straight under the plugin's name
is ignored without a word). Read from the transcript files and the debug log:

- A `sleep` started with `run_in_background` answers with `backgroundTaskId`
  in the tool's record and no `timedOutAfterMs`; the mod's first reminder
  lands as `hook_additional_context` right after the result, in the main
  loop and in a subagent's alike.
- In an idle session each due reminder came at the first tick past its mark
  as a prompt of its own, "The caffeine plugin sent a message:
  Reminder: …", with the toast, and the model answered it in a turn of its
  own. The debug log names the calls, `$.prompt.submit (caffeine): …`
  and `$.ui.toast (caffeine): …`, then "prompt.submit skipped:
  re-entry" for the mod's own hook, which the engine leaves out for the
  plugin's own prompt.
- Inside a running turn (a foreground `sleep 140` right after the
  backgrounding) the due reminder went in as a user row while the sleep ran,
  and the model read it with the sleep's result at its next request: "this
  reminder arrived afterwards and says … has run for 2 minutes". A turn
  inside one tool call reads nothing until that call returns.
- A background subagent's shell survives the subagent: its result carries no
  `backgroundEndsWithFinalResponse`. The stop's notification of a shell woke
  the background subagent that had ended its turn, so a background
  subagent's loop is not gone after its first turn.
- A completion notification passes `prompt.submit` with origin
  `task-notification` and the text `<task-notification>\n<task-id>…`; the
  tracking ended there in every run.

A reminder comes at the first tick past its mark, so up to a minute after
it: a mark missed by three seconds came as "has run for 2 minutes".

## How 0.1.0 was checked: the subagent hold

The hold below is 0.1.0's, which held every subagent; 0.1.1 narrowed it, see
the next section. The engine raises the settings hook SubagentStop to a module as
`classic.SubagentStop` (`e.agent_id`, the same id the subagent's `agentId`
carries in `tool.call` and `turn.complete`), and a `{ block: reason }` result
keeps the subagent's turn going: the reason reaches it as the next message
and its loop makes another request. The app's 2.1.299 binary, headless, as
above, `--setting-sources project` so that the user's own SubagentStop hook
stays out of the probe, and a haiku subagent told to start `/bin/sleep 25`
with `run_in_background` and end its turn:

- The first end was blocked with the mod's reason; the subagent waited in a
  foreground Bash call (25 s), and its second end passed. The lead got the
  command's real result, and no hand-over note.
- A subagent told to treat the command as a dev server answered the block with
  a report naming it and ended again: the second end passed, the hand-over
  note reached the main conversation, and the lead repeated it.

A completion notice of a subagent's shell does not pass `prompt.submit`, so
the tracking of such a shell does not end by itself. What the engine does
write is `[exited with code N]` at the end of the output file; the mod reads
it before a hold, a hand-over and a reminder, and drops a task that shows it.
Without that, the first probe handed the lead a "still running" note for a
command the subagent had waited out. An output over 4 MB is not read, so such
a task counts as running.

In a plugin a person installs where an organization manages Claude Code,
`classic.*` events pass over the plugin (`claude plugin validate` says so), so
the hold needs the plugin to be listed in the managed settings there.

## How 0.1.1 was checked: the hold only where the shell dies

Claude Code 2.1.301, headless as above, the plugin loaded with `--plugin-dir`,
haiku subagents told to start `/bin/sleep 20; echo DONE-MARK` in one of two
ways (`run_in_background`, or a plain Bash call with `timeout: 5000`, which the
engine moves to the background), each spawned in the foreground and in the
background: four runs. `backgroundEndsWithFinalResponse` was read from a
scratch copy of the mod that toasted the Bash result into the debug log
(`$.ui.toast (caffeine): …`). With caffeine off the same four cases behave as
the next two bullets say (measured the day before the mod was narrowed).

- `backgroundEndsWithFinalResponse` is `true` in the result of a foreground
  subagent's backgrounded Bash, for both ways (`run_in_background` and the
  timeout), and absent in a background subagent's, for both ways. The result
  text of the foreground one says the shell is "terminated when you give your
  final response". The flag is reliable on this build, so the mod keys on it.
- A background subagent that ended its turn with its shell running was woken
  when the shell finished, read the output file and answered; the lead got an
  interim "waiting" (a completion notice saying it may resume on its own) and
  later the real result. A foreground subagent's shell is killed when it ends
  its turn (task notification "stopped", output ending `[killed]`) and the
  lead gets only "waiting".
- With the narrowed hold, the two foreground runs were held once (the
  "Stop hook feedback" row is in the subagent's transcript file), waited for
  the shell and returned `DONE-MARK` to the lead; the two background runs
  ended freely, were woken by the engine and returned `DONE-MARK` to the lead.
- The first run of the narrowed hold still handed a background subagent's
  shell to the main conversation at the subagent's `turn.complete` ("nobody
  watches it now"), and the lead obeyed with `TaskStop`: the shell was killed,
  the woken subagent read `[killed]`, and the result was lost. That handover is
  gone: a background subagent's shell stays the subagent's, its reminders go to
  its loop, and only a reminder the gone loop refuses goes to the main
  conversation.

## An edit of the plugin folder reloads the mod inside every probe

The engine watches each `--plugin-dir` folder ("plugin-dir watch: watching
caffeine" in the debug log): live at first, then, after about a minute
without a change, a poll every 30 seconds. A write there, a `touch`
included, reloads the mod in the running session: `register` runs again,
`session.start` is raised for the mod alone ("session.start: raised for
caffeine (loaded later)"), the old environment's timers are gone,
`$.state` stays. Checked with a `touch` twenty seconds into a probe: the
ticks moved to the reload's cadence, none of the old one came, no reminder
doubled, the task stayed tracked, and the reminder due in that minute came
at the new timer's first tick.

That is what the first two probes ran into: a wording edit landed in the
minute where the 1-minute reminder was due, both sessions printed
"caffeine: reloaded", the due tick never came and the next reminder
came a minute after the reload. The clean reruns had every reminder on
time. So the plugin folder is left alone, no edit, test or validate, while
a probe of it runs.

## What the validator holds a module to

`claude plugin validate` refuses a module that passes `$` to a function
that is not a top-level function declaration of the file: a `remind($, …)`
nested in `register` was refused with "$ is passed to "remind", which is not a
function declared at the top of this file". So the helpers that take `$` are
top-level functions, and what they share with `register` (whether the main
loop is in a turn, whether a pass is under way) is a module-level object.

## What the test kit answers for `$` calls

A test's hook on a `$`-call event (`fs.stat`, `fs.read`, `ui.toast`) answers
`{ value }` or `{ deny }`; a bare return is "returned neither { value } nor
{ deny }" and the hook is skipped. `mock.session(on)` registers the test's
one `session.append` hook, so a test that also hooks `session.append` itself
(to refuse an append to a gone subagent) records the rows in that hook and
leaves `mock.session` out. A `{ deny }` from a `session.append` hook comes
back to the plugin's `$.session.append` as a resolved `{ deny }`, while the
engine's own refusal (an `agentId` that names no running loop) rejects; the
mod treats both as "the loop is gone".
