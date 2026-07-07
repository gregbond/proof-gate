import type { HonestyDepth, ProofClass, ProofState } from "./config.js";

export interface EvidencePointer {
  type?: string;
  value?: string;
  path?: string;
  url?: string;
  command?: string;
  query?: string;
  expected_sha?: string;
  expected_status?: number;
  expected_count?: number;
}

export interface ProofDetails {
  class?: string;
  reason?: string;
  evidence?: EvidencePointer[] | EvidencePointer;
}

export interface ProofBlock {
  id?: string;
  status?: string;
  proof_state?: string;
  expected_sha?: string;
  expected_status?: number;
  expected_count?: number;
  reason?: string;
  proof?: ProofDetails;
}

export interface CheckContext {
  filePath?: string;
  baseDir: string;
  network: boolean;
  allowExec: boolean;
}

export interface VerifierPass {
  ok: true;
  className: ProofClass;
  depth: HonestyDepth;
  message: string;
}

export interface VerifierFail {
  ok: false;
  className?: ProofClass;
  message: string;
}

export type VerifierResult = VerifierPass | VerifierFail;

export interface ProofCheckPass {
  ok: true;
  id: string;
  proofState: ProofState;
  className: ProofClass;
  depth: HonestyDepth;
  message: string;
}

export interface ProofCheckFail {
  ok: false;
  id: string;
  message: string;
}

export type ProofCheckResult = ProofCheckPass | ProofCheckFail;
