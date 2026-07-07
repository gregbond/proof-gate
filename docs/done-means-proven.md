# Done Means Proven

Software teams have overloaded one word until it stopped meaning anything.

Done can mean a patch exists. It can mean tests passed. It can mean a PR merged. It can mean the deploy job ran. It can mean the live system behaved correctly. In agent-heavy workflows, the collapse gets worse because agents are very good at producing confident summaries from partial evidence.

The failure is not only capability. It is epistemology.

If another actor cannot independently inspect or rerun the evidence, the claim is not runtime truth. It is narrative truth. Narrative truth can be useful for routing, but it should not close work.

## The missing vocabulary

A done claim should name what kind of proof backs it:

- `local`: the local worktree or developer runtime proved it
- `ci`: automated checks proved the branch or PR path
- `deploy`: the deploy marker or release path moved to the expected version
- `runtime`: the running system was exercised
- `db`: authoritative stored state was inspected
- `visual`: a rendered screen or screenshot proved the visual claim
- `no-go`: the correct outcome was to stop, roll back, or decide not to ship

The last class matters. Most definition-of-done systems have no vocabulary for a correct no. They reward motion and leave stopped work looking incomplete. But sometimes the highest-quality outcome is proving that a lane should not ship.

## The rule

`done` requires a proof state, a proof class, and evidence that can be inspected or rerun.

Not merely a sentence. Not merely a link. Not merely a JSON file that an agent could have fabricated.

The evidence has to match the claim. A local file can justify `local_only`. It cannot justify `runtime_proven`. A release marker can justify `deployed`. It cannot prove the live API behavior unless the runtime was exercised too.

This is the invariant behind `proof-gate`:

```text
status=done requires proof_state != none
proof_state=runtime_proven requires class in runtime, db, visual
class chooses the verifier
verifier prints honesty depth
```

The depth label is the honesty contract:

```text
existence < shape < inspected < reran
```

A gate that only checks for a pointer should say it checked existence. A gate that curls a healthcheck should say it reran runtime evidence. The difference is the whole point.

## What a gate can and cannot do

A small CI gate cannot prove every truth about production. It can make false confidence harder.

`proof-gate` v0.1 does not claim omniscience. It makes proof claims inspectable, class-aware, and verifier-backed with explicit honesty depth. Some verifiers are intentionally shallow in v0.1. CI URLs are shape-checked. Local files are existence-checked. Deploy markers, runtime receipts, DB receipts, and visual screenshots are inspected. Runtime URLs and command/query checks can be rerun when explicitly allowed.

That scope is not a caveat buried at the bottom. It is the architecture. The class to verifier mapping is first-class so deeper adapters can replace shallow checks without changing the contract.

## The output should tell the truth

A legitimate deploy proof should look like this:

```text
PASS DEPLOY-1 [deploy/inspected]: release marker sha matches abc123
```

A legitimate runtime receipt should look like this:

```text
PASS RUNTIME-1 [runtime/inspected]: runtime receipt status 200
```

And a local file pretending to be runtime proof should fail before any verifier runs:

```text
FAIL LIE-2: proof_state=runtime_proven cannot be justified by class=local; expected one of runtime, db, visual
```

That is the difference between pointer discipline and proof discipline.

## Why this matters more with agents

Humans also blur proof states, but agents amplify the problem. They can summarize a desired outcome in polished language, cite files that exist, and move work across tools faster than teams can verify the underlying claim.

The answer is not to distrust agents. The answer is to give them contracts that make truth inspectable.

A good agent should be able to say:

```text
local-only: tests pass here
PR-open: reviewable branch exists
merged: main contains the change
deployed: release marker matches the SHA
runtime-proven: live behavior was exercised
closed-no-go: evidence says stop
```

Those are different claims. They deserve different proof.

## The launch target

Attention is not adoption. Stars, comments, and traffic are useful, but they are not runtime proof.

The real launch proof for this project is one repo I do not control committing a `proof-gate.yml` workflow or equivalent CI integration. That is the moment the idea leaves narrative truth and becomes runtime truth.
