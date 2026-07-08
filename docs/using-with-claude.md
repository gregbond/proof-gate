# Using proof-gate with Claude Code

proof-gate does not compete with Claude. It is the guardrail around Claude's
"I'm done" claims. Keep using Claude exactly as you do now. Add one rule: when
Claude marks a task done, it also writes a Proof block, and proof-gate checks
that the proof class justifies the claim and that the evidence can be inspected
or rerun.

## 1. Add the rule to `CLAUDE.md`

```md
When you mark work as done, include a Proof block.

proof_state (how far along): local_only, pr_open, merged, deployed, runtime_proven, closed_no_go
proof class (kind of evidence): local, ci, deploy, runtime, db, visual, no-go

Do not claim runtime_proven from local tests. runtime_proven requires runtime,
db, or visual evidence. Prefer no-go with a reason over leaving stopped work
looking unfinished.
```

## 2. Claude writes a Proof block in the PR body

A fenced `Proof:` block, exactly the shipped format:

````markdown
Proof:
```yaml
id: PR-42
status: done
proof_state: deployed
expected_sha: abc123
proof:
  class: deploy
  evidence:
    - type: release_json
      value: release.json
      expected_sha: abc123
```
````

proof-gate reads `release.json`, compares the SHA, and prints the honesty depth
it reached:

```text
PASS PR-42 [deploy/inspected]: release marker sha matches abc123
```

## 3. The GitHub Action gates every PR

```yaml
name: proof-gate
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
jobs:
  proof-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: gregbond/proof-gate@v0.1
        with:
          mode: pr
```

Now Claude can still do all the work, but it cannot silently collapse "I changed
code," "tests passed," "PR merged," "deployed," and "live behavior verified" into
one word.

## What you get immediately

A cheap falsifiability layer for Claude-generated work. When Claude over-claims,
the gate refuses it before any verifier runs:

```text
FAIL LIE-1: status=done requires a proof_state from local_only, pr_open, merged, deployed, runtime_proven, closed_no_go; got missing
FAIL LIE-2: proof_state=runtime_proven cannot be justified by class=local; expected one of runtime, db, visual
```

It does not make Claude smarter. It makes Claude's claims checkable.

## If you only use Claude chat: no terminal, no CI

Then proof-gate is weaker as a tool but still useful as a contract. Ask Claude:

> Before saying done, produce a proof-gate Proof block. If the proof class does
> not justify the proof_state, say "not done" instead.

But that is Claude grading itself. The real value shows up when an external
checker runs the same rule, in CI or locally:

```bash
npx @relaxedg/proof-gate@latest check tasks/
```

Claude cannot fudge a check it does not run.
