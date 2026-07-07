import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expectedClassesForState, maxDepth, normalizeProofClass, normalizeProofState } from "./config.js";
import type { EvidencePointer, ProofBlock, ProofCheckResult, VerifierResult } from "./types.js";
import type { ProofClass } from "./config.js";

function idFor(block: ProofBlock): string {
  return block.id?.trim() || "unknown";
}

function evidenceList(block: ProofBlock): EvidencePointer[] {
  const evidence = block.proof?.evidence;
  if (!evidence) return [];
  return Array.isArray(evidence) ? evidence : [evidence];
}

function evidenceValue(evidence: EvidencePointer): string {
  return evidence.value || evidence.path || evidence.url || evidence.command || evidence.query || "";
}

function resolveEvidencePath(raw: string, baseDir: string): string {
  return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
}

function pass(className: ProofClass, depth: "existence" | "shape" | "inspected" | "reran", message: string): VerifierResult {
  return { ok: true, className, depth, message };
}

function fail(className: ProofClass, message: string): VerifierResult {
  return { ok: false, className, message };
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function firstObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return undefined;
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function verifyLocal(evidence: EvidencePointer, block: ProofBlock, baseDir: string, allowExec: boolean): VerifierResult {
  const value = evidenceValue(evidence);
  if (!value) return fail("local", "local evidence needs a file path or command");
  if (evidence.type === "command" || evidence.command) {
    if (!allowExec) return fail("local", "local command evidence requires --allow-exec");
    execSync(value, { stdio: "pipe", cwd: baseDir });
    return pass("local", "reran", `command exited 0: ${value}`);
  }
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("local", `file does not exist: ${value}`);
  return pass("local", "existence", `file exists: ${value}`);
}

function verifyCi(evidence: EvidencePointer): VerifierResult {
  const value = evidenceValue(evidence);
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/(actions\/runs\/\d+|pull\/\d+|commit\/[0-9a-f]{7,40}|checks)/i.test(value)) {
    return fail("ci", "ci evidence must look like a GitHub PR, commit, check, or Actions run URL");
  }
  return pass("ci", "shape", `GitHub CI/PR URL shape accepted: ${value}`);
}

function verifyDeploy(evidence: EvidencePointer, block: ProofBlock, baseDir: string): VerifierResult {
  const value = evidenceValue(evidence);
  if (!value) return fail("deploy", "deploy evidence needs a release.json path");
  const expectedSha = evidence.expected_sha || block.expected_sha;
  if (!expectedSha) return fail("deploy", "deploy evidence needs expected_sha");
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("deploy", `release marker does not exist: ${value}`);
  const marker = firstObject(readJsonFile(filePath));
  const actualSha = String(marker?.sha || marker?.commit || marker?.release_sha || "");
  if (!actualSha) return fail("deploy", `release marker has no sha-like field: ${value}`);
  if (actualSha !== expectedSha) return fail("deploy", `release marker sha mismatch: expected ${expectedSha}, got ${actualSha}`);
  return pass("deploy", "inspected", `release marker sha matches ${expectedSha}`);
}

async function verifyRuntime(evidence: EvidencePointer, block: ProofBlock, baseDir: string, network: boolean): Promise<VerifierResult> {
  const value = evidenceValue(evidence);
  if (!value) return fail("runtime", "runtime evidence needs a URL or receipt file");
  const expectedStatus = evidence.expected_status || block.expected_status || 200;
  if (/^https?:\/\//i.test(value)) {
    if (!network) return fail("runtime", "runtime URL evidence requires --network or a saved receipt");
    const response = await fetch(value);
    if (response.status !== expectedStatus) return fail("runtime", `runtime GET expected ${expectedStatus}, got ${response.status}`);
    return pass("runtime", "reran", `GET ${value} returned ${response.status}`);
  }
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("runtime", `runtime receipt does not exist: ${value}`);
  const receipt = firstObject(readJsonFile(filePath));
  const status = numeric(receipt?.status_code ?? receipt?.status ?? receipt?.http_status);
  if (status === undefined) return fail("runtime", `runtime receipt has no status field: ${value}`);
  if (status !== expectedStatus) return fail("runtime", `runtime receipt expected ${expectedStatus}, got ${status}`);
  return pass("runtime", "inspected", `runtime receipt status ${status}`);
}

function verifyDb(evidence: EvidencePointer, block: ProofBlock, baseDir: string, allowExec: boolean): VerifierResult {
  const value = evidenceValue(evidence);
  if (!value) return fail("db", "db evidence needs a receipt file or command");
  if (evidence.type === "command" || evidence.command || evidence.query) {
    if (!allowExec) return fail("db", "db command/query evidence requires --allow-exec");
    execSync(value, { stdio: "pipe", cwd: baseDir });
    return pass("db", "reran", "db command/query exited 0");
  }
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("db", `db receipt does not exist: ${value}`);
  const receipt = firstObject(readJsonFile(filePath));
  const actualCount = numeric(receipt?.count ?? receipt?.row_count ?? receipt?.rows);
  const expectedCount = evidence.expected_count ?? block.expected_count;
  if (expectedCount !== undefined && actualCount !== expectedCount) {
    return fail("db", `db receipt expected count ${expectedCount}, got ${actualCount ?? "missing"}`);
  }
  return pass("db", "inspected", expectedCount === undefined ? "db receipt inspected" : `db count ${actualCount}`);
}

function verifyVisual(evidence: EvidencePointer, block: ProofBlock, baseDir: string): VerifierResult {
  const value = evidenceValue(evidence);
  if (!value) return fail("visual", "visual evidence needs a screenshot path");
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("visual", `screenshot does not exist: ${value}`);
  const bytes = fs.readFileSync(filePath);
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isGif = bytes.length >= 6 && bytes.subarray(0, 3).toString("ascii") === "GIF";
  if (!isPng && !isJpeg && !isGif) return fail("visual", `screenshot is not PNG/JPEG/GIF by magic bytes: ${value}`);
  return pass("visual", "inspected", `image magic bytes verified: ${value}`);
}

function verifyNoGo(evidence: EvidencePointer, block: ProofBlock, baseDir: string): VerifierResult {
  const reason = block.reason || block.proof?.reason;
  if (!reason?.trim()) return fail("no-go", "closed_no_go requires a reason");
  const value = evidenceValue(evidence);
  if (!value) return fail("no-go", "no-go evidence needs a pointer");
  if (/^https?:\/\//i.test(value)) return pass("no-go", "shape", `no-go URL shape accepted: ${value}`);
  const filePath = resolveEvidencePath(value, baseDir);
  if (!fs.existsSync(filePath)) return fail("no-go", `no-go evidence file does not exist: ${value}`);
  if (fs.statSync(filePath).size === 0) return fail("no-go", `no-go evidence file is empty: ${value}`);
  return pass("no-go", "inspected", `no-go evidence file inspected: ${value}`);
}

async function verifyEvidence(className: ProofClass, evidence: EvidencePointer, block: ProofBlock, baseDir: string, network: boolean, allowExec: boolean): Promise<VerifierResult> {
  switch (className) {
    case "local":
      return verifyLocal(evidence, block, baseDir, allowExec);
    case "ci":
      return verifyCi(evidence);
    case "deploy":
      return verifyDeploy(evidence, block, baseDir);
    case "runtime":
      return verifyRuntime(evidence, block, baseDir, network);
    case "db":
      return verifyDb(evidence, block, baseDir, allowExec);
    case "visual":
      return verifyVisual(evidence, block, baseDir);
    case "no-go":
      return verifyNoGo(evidence, block, baseDir);
  }
}

export async function checkProofBlock(block: ProofBlock, options: { filePath?: string; network?: boolean; allowExec?: boolean } = {}): Promise<ProofCheckResult> {
  const id = idFor(block);
  const status = block.status?.trim().toLowerCase();
  const rawState = block.proof_state;
  const proofState = normalizeProofState(rawState);
  if (status === "done" && !proofState) {
    return { ok: false, id, message: `status=done requires a proof_state from local_only, pr_open, merged, deployed, runtime_proven, closed_no_go; got ${rawState ? String(rawState) : "missing"}` };
  }
  if (status === "done" && proofState === "none") {
    return { ok: false, id, message: "status=done requires proof_state to be non-none" };
  }
  if (!proofState || proofState === "none") {
    return { ok: false, id, message: "proof_state is required" };
  }
  const className = normalizeProofClass(block.proof?.class);
  if (!className) return { ok: false, id, message: `proof.class is required and must be one of: local, ci, deploy, runtime, db, visual, no-go` };
  const expected = expectedClassesForState(proofState);
  if (!expected.includes(className)) {
    return { ok: false, id, message: `proof_state=${proofState} cannot be justified by class=${className}; expected one of ${expected.join(", ")}` };
  }
  if (proofState === "closed_no_go" && !(block.reason || block.proof?.reason)?.trim()) {
    return { ok: false, id, message: "proof_state=closed_no_go requires a reason" };
  }
  const evidence = evidenceList(block);
  if (evidence.length === 0) return { ok: false, id, message: "proof.evidence requires at least one pointer" };
  const baseDir = options.filePath ? path.dirname(options.filePath) : process.cwd();
  const results: VerifierResult[] = [];
  for (const pointer of evidence) {
    results.push(await verifyEvidence(className, pointer, block, baseDir, Boolean(options.network), Boolean(options.allowExec)));
  }
  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return { ok: false, id, message: failed.message };
  const passes = results.filter((result): result is Extract<VerifierResult, { ok: true }> => result.ok);
  const depth = maxDepth(passes.map((result) => result.depth));
  return { ok: true, id, proofState, className, depth, message: passes.map((result) => result.message).join("; ") };
}
