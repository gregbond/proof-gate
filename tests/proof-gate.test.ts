import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverProofFiles, parsePrBodyFile } from "../src/parse.js";
import { checkProofBlock } from "../src/verify.js";
import type { ProofBlock } from "../src/types.js";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "proof-gate-test-"));
}

function write(dir: string, name: string, content: string | Buffer): string {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe("proof-gate", () => {
  it("rejects done without proof_state", async () => {
    const result = await checkProofBlock({ id: "LIE-1", status: "done", proof: { class: "local", evidence: { value: "x" } } });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("status=done requires a proof_state");
  });

  it("rejects runtime_proven justified by local proof", async () => {
    const result = await checkProofBlock({ id: "LIE-2", status: "done", proof_state: "runtime_proven", proof: { class: "local", evidence: { value: "x" } } });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("expected one of runtime, db, visual");
  });

  it("passes local file evidence at existence depth", async () => {
    const dir = tempDir();
    const file = write(dir, "proof.txt", "ok");
    const result = await checkProofBlock({ id: "LOCAL", status: "done", proof_state: "local_only", proof: { class: "local", evidence: { value: file } } }, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("existence");
  });

  it("passes deploy release marker SHA comparison at inspected depth", async () => {
    const dir = tempDir();
    write(dir, "release.json", JSON.stringify({ sha: "abc123" }));
    const block: ProofBlock = { id: "DEPLOY", status: "done", proof_state: "deployed", expected_sha: "abc123", proof: { class: "deploy", evidence: { value: "release.json", expected_sha: "abc123" } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("inspected");
  });

  it("fails deploy release marker SHA mismatch", async () => {
    const dir = tempDir();
    write(dir, "release.json", JSON.stringify({ sha: "wrong" }));
    const block: ProofBlock = { id: "DEPLOY-BAD", status: "done", proof_state: "deployed", expected_sha: "abc123", proof: { class: "deploy", evidence: { value: "release.json", expected_sha: "abc123" } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("sha mismatch");
  });

  it("passes runtime receipt at inspected depth", async () => {
    const dir = tempDir();
    write(dir, "receipt.json", JSON.stringify({ status: 200 }));
    const block: ProofBlock = { id: "RUNTIME", status: "done", proof_state: "runtime_proven", proof: { class: "runtime", evidence: { value: "receipt.json", expected_status: 200 } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("inspected");
  });

  it("blocks runtime URL evidence without --network", async () => {
    const block: ProofBlock = { id: "RUNTIME-URL", status: "done", proof_state: "runtime_proven", proof: { class: "runtime", evidence: { value: "https://example.com/health" } } };
    const result = await checkProofBlock(block, { network: false });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("requires --network");
  });

  it("passes visual screenshot with image magic bytes", async () => {
    const dir = tempDir();
    write(dir, "screen.gif", "GIF89a fake");
    const block: ProofBlock = { id: "VISUAL", status: "done", proof_state: "runtime_proven", proof: { class: "visual", evidence: { value: "screen.gif" } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("inspected");
  });

  it("requires a reason for closed_no_go", async () => {
    const block: ProofBlock = { id: "NO-GO-BAD", status: "done", proof_state: "closed_no_go", proof: { class: "no-go", evidence: { value: "x" } } };
    const result = await checkProofBlock(block);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("requires a reason");
  });

  it("passes closed_no_go with reason and evidence file", async () => {
    const dir = tempDir();
    write(dir, "no-go.md", "stop");
    const block: ProofBlock = { id: "NO-GO", status: "done", proof_state: "closed_no_go", reason: "correctly stopped", proof: { class: "no-go", evidence: { value: "no-go.md" } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("inspected");
  });

  it("extracts a fenced Proof block from a PR body", () => {
    const dir = tempDir();
    const file = write(dir, "pr.md", "Proof:\n```yaml\nid: PR\nstatus: done\nproof_state: local_only\nproof:\n  class: local\n  evidence:\n    - value: proof.txt\n```\n");
    const block = parsePrBodyFile(file);
    expect(block.id).toBe("PR");
    expect(block.proof_state).toBe("local_only");
  });

  it("discovers proof files in sorted order", () => {
    const dir = tempDir();
    write(dir, "b.yml", "id: B");
    write(dir, "a.yaml", "id: A");
    write(dir, "ignore.txt", "x");
    expect(discoverProofFiles(dir).map((file) => path.basename(file))).toEqual(["a.yaml", "b.yml"]);
  });

  it("passes db count receipt at inspected depth", async () => {
    const dir = tempDir();
    write(dir, "db.json", JSON.stringify({ count: 3 }));
    const block: ProofBlock = { id: "DB", status: "done", proof_state: "runtime_proven", expected_count: 3, proof: { class: "db", evidence: { value: "db.json", expected_count: 3 } } };
    const result = await checkProofBlock(block, { filePath: path.join(dir, "task.yml") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.depth).toBe("inspected");
  });
});
