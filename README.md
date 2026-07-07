# proof-gate

A tiny CLI and GitHub Action that makes `done` require class-aware, inspectable evidence.

Most workflows use one word for several different claims:

- code changed
- checks passed
- a PR merged
- a deploy marker moved
- a live system behaved correctly
- a team correctly decided not to ship

`proof-gate` forces the claim to name its proof class and then runs the matching verifier. It does not pretend that a pointer is truth. Every pass prints an honesty depth:

```text
existence < shape < inspected < reran
```

## Install

```bash
npx proof-gate@latest --help
```

For a local checkout:

```bash
npm install
npm run build
npm test
npm run check
```

## Quick demo

```bash
npx proof-gate@latest check examples/toy-service/tasks
```

Example output:

```text
PASS LOCAL-1 [local/existence]: file exists: ../evidence/unit-test.txt
PASS PR-1 [ci/shape]: GitHub CI/PR URL shape accepted: https://github.com/gregbond/proof-gate/actions/runs/123456789
PASS MERGED-1 [ci/shape]: GitHub CI/PR URL shape accepted: https://github.com/gregbond/proof-gate/commit/abcdef1
PASS DEPLOY-1 [deploy/inspected]: release marker sha matches abc123
PASS RUNTIME-1 [runtime/inspected]: runtime receipt status 200
PASS NO-GO-1 [no-go/inspected]: no-go evidence file inspected: ../evidence/no-go.md
```

And the two lies this exists to reject:

```text
FAIL LIE-1: status=done requires a proof_state from local_only, pr_open, merged, deployed, runtime_proven, closed_no_go; got missing
FAIL LIE-2: proof_state=runtime_proven cannot be justified by class=local; expected one of runtime, db, visual
```

## Proof classes

Opinionated defaults:

- `local`: local files or commands
- `ci`: CI, PR, check, or commit evidence
- `deploy`: release marker inspection, usually a SHA comparison
- `runtime`: live healthcheck rerun or saved runtime receipt inspection
- `db`: query rerun or DB receipt inspection
- `visual`: screenshot/image inspection
- `no-go`: proof that the correct outcome was not to ship

`closed_no_go` is first-class. A stopped lane can be the correct result when the proof says stop.

## Task contract

```yaml
id: RUNTIME-1
status: done
proof_state: runtime_proven
proof:
  class: runtime
  evidence:
    - type: receipt
      value: ../evidence/runtime-receipt.json
      expected_status: 200
```

`status: done` requires a non-`none` `proof_state`, a coherent `proof.class`, and at least one evidence pointer that the class verifier can inspect or rerun.

## PR body check

Put a fenced `Proof:` block in the PR body:

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
      value: examples/toy-service/release.json
      expected_sha: abc123
```
````

Then run:

```bash
proof-gate check-pr pr-body.md
```

## GitHub Action

```yaml
name: proof-gate
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  proof-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gregbond/proof-gate@v0.1
        with:
          mode: pr
```

For a task directory:

```yaml
- uses: actions/checkout@v4
- uses: gregbond/proof-gate@v0.1
  with:
    mode: check
    path: examples/toy-service/tasks
```

## What v0.1 can and cannot prove

`proof-gate` does not magically prove every external truth. It makes proof claims inspectable, class-aware, and verifier-backed with explicit honesty depth.

Current verifier depths:

| Class | v0.1 behavior | Typical depth |
| --- | --- | --- |
| local | file exists, or command exits 0 with `--allow-exec` | existence or reran |
| ci | GitHub PR, commit, check, or Actions run URL shape | shape |
| deploy | reads release marker and compares SHA | inspected |
| runtime | reads saved receipt, or performs GET with `--network` | inspected or reran |
| db | reads count receipt, or runs command/query with `--allow-exec` | inspected or reran |
| visual | verifies screenshot magic bytes | inspected |
| no-go | requires reason plus non-empty file or URL | inspected or shape |

The class to verifier seam is the product. Richer adapters should raise claims from `existence` or `shape` to `inspected` or `reran`.

## Contributing

v0.1 is intentionally small. The most useful contributions are new verifiers that raise honesty depth from `existence` or `shape` to `inspected` or `reran`, especially for real CI, deploy, runtime, DB, and issue-tracker workflows.

If you try `proof-gate` and it does not fit where your team declares "done," please open an issue with:

- where the done signal lives
- what evidence already exists
- what proof class you expected
- what verifier would make the claim inspectable or rerunnable

## Essay

Read the launch essay: [Done Means Proven](docs/done-means-proven.md).
