# Example PR

This PR updates the toy service.

Proof:
```yaml
id: PR-BODY-1
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
