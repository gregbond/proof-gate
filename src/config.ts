export const PROOF_CLASSES = ["local", "ci", "deploy", "runtime", "db", "visual", "no-go"] as const;

export const PROOF_STATES = [
  "none",
  "local_only",
  "pr_open",
  "merged",
  "deployed",
  "runtime_proven",
  "closed_no_go",
] as const;

export const HONESTY_DEPTHS = ["existence", "shape", "inspected", "reran"] as const;

export type ProofClass = (typeof PROOF_CLASSES)[number];
export type ProofState = (typeof PROOF_STATES)[number];
export type HonestyDepth = (typeof HONESTY_DEPTHS)[number];

const STATE_TO_CLASSES: Record<Exclude<ProofState, "none">, ProofClass[]> = {
  local_only: ["local"],
  pr_open: ["local", "ci"],
  merged: ["ci"],
  deployed: ["deploy"],
  runtime_proven: ["runtime", "db", "visual"],
  closed_no_go: ["no-go"],
};

export function normalizeProofState(value: unknown): ProofState | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  return (PROOF_STATES as readonly string[]).includes(normalized) ? (normalized as ProofState) : undefined;
}

export function normalizeProofClass(value: unknown): ProofClass | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return (PROOF_CLASSES as readonly string[]).includes(normalized) ? (normalized as ProofClass) : undefined;
}

export function expectedClassesForState(state: ProofState): ProofClass[] {
  if (state === "none") return [];
  return STATE_TO_CLASSES[state];
}

export function depthRank(depth: HonestyDepth): number {
  return HONESTY_DEPTHS.indexOf(depth);
}

export function maxDepth(depths: HonestyDepth[]): HonestyDepth {
  return depths.reduce((best, next) => (depthRank(next) > depthRank(best) ? next : best), "existence" as HonestyDepth);
}
