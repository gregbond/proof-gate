import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { ProofBlock } from "./types.js";

const PROOF_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export function loadStructuredText(raw: string, source: string): ProofBlock {
  const ext = path.extname(source).toLowerCase();
  const parsed = ext === ".json" ? JSON.parse(raw) : yaml.load(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} did not parse to an object`);
  }
  return parsed as ProofBlock;
}

export function readProofFile(filePath: string): ProofBlock {
  return loadStructuredText(fs.readFileSync(filePath, "utf8"), filePath);
}

export function discoverProofFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) throw new Error(`${target} is neither a file nor a directory`);
  return fs
    .readdirSync(target)
    .filter((entry) => PROOF_EXTENSIONS.has(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(target, entry))
    .sort();
}

export function parsePrBodyFile(filePath: string): ProofBlock {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/Proof:\s*\n```(?:yaml|yml|json)?\s*\n([\s\S]*?)\n```/i);
  if (!match) {
    throw new Error(`${filePath} does not contain a fenced Proof: block`);
  }
  return loadStructuredText(match[1] ?? "", filePath.endsWith(".json") ? filePath : `${filePath}.yaml`);
}
