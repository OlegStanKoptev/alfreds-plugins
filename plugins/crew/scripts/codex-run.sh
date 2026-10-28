#!/usr/bin/env bash
# Runs one Codex job for crew:codex, detached, so a run longer than one Bash call survives.
#
#   codex-run.sh start <implement|review> <workdir> <brief-file> <run-dir>
#   codex-run.sh wait <run-dir>     blocks up to CREW_CODEX_WAIT seconds (default 540)
#   codex-run.sh stop <run-dir>
#
# Exit codes: 0 done, 1 failed, 3 still running (call wait again),
# 69 codex not installed or not logged in, 75 usage limit hit.
# The run dir holds prompt.md, log (full output), last.md (Codex's final message), exit.
set -u

limit_re='usage limit|rate limit|hit your limit|Too Many Requests'

cmd=${1:-}
case "$cmd" in
start)
  mode=$2 workdir=$3 brief=$4 run=$5
  command -v codex >/dev/null 2>&1 || { echo "UNAVAILABLE: codex is not installed"; exit 69; }
  codex login status >/dev/null 2>&1 || { echo "UNAVAILABLE: codex is not logged in (codex login)"; exit 69; }
  mkdir -p "$run"
  case "$mode" in
  implement)
    sandbox=workspace-write
    preamble="You are an implementation worker for a Claude orchestrator that will verify and review your work.
Read the repository's CLAUDE.md and AGENTS.md, if present, and follow them.
Do not commit, push, switch branches or touch files outside the brief's scope; leave your changes in the working tree.
Before you finish, run the tests and builds you claim pass. Call anything you could not check unverified.
If the task turns out to hold a design decision the brief does not settle, stop and say so instead of guessing.
Your final message is your report: the claim in one line; the evidence (commands run and their result); the files you changed; what is open." ;;
  review)
    sandbox=read-only
    preamble="You are a reviewer giving a second opinion to a Claude orchestrator. Do not modify any file.
Read the repository's CLAUDE.md and AGENTS.md, if present; their rules are part of the standard.
Your final message lists the defects you found, most severe first, each as: file:line, the defect in one sentence, a concrete input or state that makes it fail.
Only real defects: correctness, security, a broken requirement. Say \"no findings\" if there are none." ;;
  *) echo "unknown mode: $mode"; exit 2 ;;
  esac
  { printf '%s\n\n# Brief\n\n' "$preamble"; cat "$brief"; } > "$run/prompt.md"
  rm -f "$run/exit" "$run/last.md"
  args=(exec --skip-git-repo-check -s "$sandbox" -C "$workdir" -o "$run/last.md")
  [ "$sandbox" = workspace-write ] && args+=(-c sandbox_workspace_write.network_access=true)
  [ -n "${CREW_CODEX_MODEL:-}" ] && args+=(-m "$CREW_CODEX_MODEL")
  nohup bash -c 'codex "$@" - < "$0/prompt.md" > "$0/log" 2>&1; echo $? > "$0/exit"' \
    "$run" "${args[@]}" >/dev/null 2>&1 &
  echo $! > "$run/pid"
  date +%s > "$run/started"
  echo "STARTED: $run"
  ;;
wait)
  run=$2
  deadline=$(( $(date +%s) + ${CREW_CODEX_WAIT:-540} ))
  while [ ! -f "$run/exit" ] && [ "$(date +%s)" -lt "$deadline" ]; do sleep 5; done
  if [ ! -f "$run/exit" ]; then
    echo "RUNNING: $(( $(date +%s) - $(cat "$run/started") ))s so far, log $run/log"; exit 3
  fi
  code=$(cat "$run/exit")
  if [ "$code" = 0 ] && [ -s "$run/last.md" ]; then echo "DONE: report $run/last.md"; exit 0; fi
  if grep -Eiq "$limit_re" "$run/log"; then echo "LIMIT: Codex usage limit, log $run/log"; exit 75; fi
  echo "FAILED: exit $code, log $run/log"; exit 1
  ;;
stop)
  run=$2
  pid=$(cat "$run/pid" 2>/dev/null) && pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null
  echo "STOPPED: $run"
  ;;
*) sed -n '2,10p' "$0"; exit 2 ;;
esac
