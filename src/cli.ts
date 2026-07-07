#!/usr/bin/env node
import path from "node:path";
import { discoverProofFiles, parsePrBodyFile, readProofFile } from "./parse.js";
import { checkProofBlock } from "./verify.js";

interface CliOptions {
  network: boolean;
  allowExec: boolean;
}

function usage(): string {
  return `proof-gate

Usage:
  proof-gate check <file-or-directory> [--network] [--allow-exec]
  proof-gate check-pr <pr-body-file> [--network] [--allow-exec]

Examples:
  proof-gate check examples/toy-service/tasks
  proof-gate check-pr examples/toy-service/pr-body.md
`;
}

function parseFlags(args: string[]): { positional: string[]; options: CliOptions } {
  const positional: string[] = [];
  const options: CliOptions = { network: false, allowExec: false };
  for (const arg of args) {
    if (arg === "--network") options.network = true;
    else if (arg === "--allow-exec") options.allowExec = true;
    else positional.push(arg);
  }
  return { positional, options };
}

async function runCheck(target: string, options: CliOptions): Promise<number> {
  const files = discoverProofFiles(target);
  let failed = 0;
  for (const file of files) {
    const block = readProofFile(file);
    const result = await checkProofBlock(block, { filePath: file, ...options });
    if (result.ok) {
      console.log(`PASS ${result.id} [${result.className}/${result.depth}]: ${result.message}`);
    } else {
      failed += 1;
      console.error(`FAIL ${result.id}: ${result.message}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function runCheckPr(file: string, options: CliOptions): Promise<number> {
  const block = parsePrBodyFile(file);
  const result = await checkProofBlock(block, { filePath: path.resolve(file), ...options });
  if (result.ok) {
    console.log(`PASS ${result.id} [${result.className}/${result.depth}]: ${result.message}`);
    return 0;
  }
  console.error(`FAIL ${result.id}: ${result.message}`);
  return 1;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const command = argv[0];
  const { positional, options } = parseFlags(argv.slice(1));
  try {
    if (!command || command === "--help" || command === "-h") {
      console.log(usage());
      return 0;
    }
    if (command === "check") {
      if (!positional[0]) throw new Error("check requires a file or directory");
      return await runCheck(positional[0], options);
    }
    if (command === "check-pr") {
      if (!positional[0]) throw new Error("check-pr requires a PR body file");
      return await runCheckPr(positional[0], options);
    }
    console.error(usage());
    return 2;
  } catch (error) {
    console.error(`proof-gate: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

main().then((code) => {
  process.exitCode = code;
});
