/**
 * Static validation for the pi-agentic repository.
 *
 * Run with: `npm run validate` (or `node --experimental-strip-types scripts/validate.ts`).
 *
 * Checks agent frontmatter, workflow metadata, agent references from
 * workflows, the expected inventory, and the repository boundary (no
 * orchestration dependency in pi-setup, none in this package's deps).
 * Dependency-free so it runs before `npm install`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const errors: string[] = [];
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => errors.push(msg);

function frontmatter(file: string): Record<string, string> {
  const src = readFileSync(file, "utf-8");
  const match = src.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const out: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2];
    if (value === ">" || value === "|-") {
      const body: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1]) && lines[i + 1].trim()) {
        body.push(lines[++i].trim());
      }
      value = body.join(value === ">" ? " " : "\n");
    }
    out[kv[1]] = value;
  }
  return out;
}

const KNOWN_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "grep",
  "find",
  "cdp_connect",
  "cdp_disconnect",
  "cdp_goto",
  "cdp_query",
  "cdp_eval",
  "cdp_console",
  "cdp_screenshot",
  "cdp_back",
  "cdp_forward",
  "cdp_reload",
  "ask_user",
  "read_matching",
  "subagent",
  "delegate_subagent",
  "steer_subagent",
  "get_subagent_result",
  "wait_for_subagent_idle",
  "stop_subagent",
]);

console.log("\n=== Agents ===");
const agentNames = new Set<string>();
const agentFiles = readdirSync(join(ROOT, "agents"))
  .filter((entry) => entry.endsWith(".md"))
  .sort();

for (const file of agentFiles) {
  const fm = frontmatter(join(ROOT, "agents", file));
  const agentErrors: string[] = [];
  const name = file.replace(/\.md$/, "");

  if (!Object.keys(fm).length) agentErrors.push("missing or malformed frontmatter");
  if (fm.name !== name) agentErrors.push(`name "${fm.name}" != filename`);
  if (!fm.description?.trim()) agentErrors.push("missing description");
  if (!fm.model?.trim()) agentErrors.push("missing model");
  if (!["off", "low", "medium", "high"].includes(fm["model-reasoning-effort"] ?? "")) {
    agentErrors.push(`invalid model-reasoning-effort "${fm["model-reasoning-effort"]}"`);
  }
  if (!["true", "false"].includes(fm.pane ?? "")) agentErrors.push(`invalid pane "${fm.pane}"`);
  for (const tool of (fm["deny-tools"] ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)) {
    if (!KNOWN_TOOLS.has(tool)) agentErrors.push(`unknown deny-tool "${tool}"`);
  }

  // Agents/workflows are self-contained: they must not reference skill files.
  const agentBody = readFileSync(join(ROOT, "agents", file), "utf-8");
  if (/skills\/|SKILL\.md/.test(agentBody)) agentErrors.push("references skill files (must be self-contained)");

  if (agentErrors.length) agentErrors.forEach((error) => fail(`AGENT ${file}: ${error}`));
  else ok(name);
  agentNames.add(name);
}

const unique = new Set(agentFiles.map((f) => frontmatter(join(ROOT, "agents", f)).name));
if (unique.size !== agentFiles.length) fail("AGENT names are not unique");

console.log("\n=== Workflows ===");
const workflowFiles = readdirSync(join(ROOT, "workflows"))
  .filter((entry) => entry.endsWith(".md"))
  .sort();

for (const file of workflowFiles) {
  const fm = frontmatter(join(ROOT, "workflows", file));
  const wfErrors: string[] = [];

  if (!Object.keys(fm).length) wfErrors.push("missing or malformed frontmatter");
  if (!fm.description?.trim()) wfErrors.push("missing description");
  if (!fm.agents?.trim()) wfErrors.push("missing agents metadata (comma-separated agent names)");

  const declared = (fm.agents ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  for (const agent of declared) {
    if (!agentNames.has(agent)) wfErrors.push(`references unknown agent "${agent}"`);
  }

  // Agents/workflows are self-contained: they must not reference skill files.
  const workflowBody = readFileSync(join(ROOT, "workflows", file), "utf-8");
  if (/skills\/|SKILL\.md/.test(workflowBody)) wfErrors.push("references skill files (must be self-contained)");

  if (wfErrors.length) wfErrors.forEach((error) => fail(`WORKFLOW ${file}: ${error}`));
  else ok(file);
}

console.log("\n=== Inventory ===");
const EXPECTED = ["COMPATIBILITY.md", "AGENTS.md", "README.md", "LICENSE", "package.json", "scripts/setup.sh"] as const;
for (const path of EXPECTED) {
  if (!statSync(join(ROOT, path), { throwIfNoEntry: false })?.isFile()) {
    fail(`MISSING file: ${path}`);
  }
}
if (agentFiles.length === 0) fail("MISSING agents: agents/ is empty");
if (workflowFiles.length === 0) fail("MISSING workflows: workflows/ is empty");
if (!errors.some((error) => error.startsWith("MISSING"))) {
  ok(
    `all ${EXPECTED.length} expected files present, ${agentFiles.length} agent(s), ${workflowFiles.length} workflow(s)`,
  );
}

console.log("\n=== Boundary ===");
// The orchestration package is installed by scripts/setup.sh, never as a
// package dependency — and pi-setup must not depend on it or on this repo.
const depSources: Array<[string, string, string[]]> = [
  ["package.json", "pi-agentic", ["pi-graph", "@vanillagreen/pi-agents-tmux"]],
  [join(ROOT, "../pi-setup/package.json"), "pi-setup", ["pi-graph", "@vanillagreen/pi-agents-tmux", "pi-agentic"]],
];
let boundaryErrors = 0;
for (const [path, repo, needles] of depSources) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    if (repo === "pi-setup") continue; // sibling not checked out
    fail(`missing ${path}`);
    continue;
  }
  const src = readFileSync(path, "utf-8");
  for (const needle of needles) {
    if (src.includes(needle)) {
      fail(`BOUNDARY ${repo}/package.json mentions "${needle}"`);
      boundaryErrors++;
    }
  }
}
if (boundaryErrors === 0) ok("no orchestration packages in package dependencies");

const setupSrc = readFileSync(join(ROOT, "scripts/setup.sh"), "utf-8");
if (!setupSrc.includes("pi-setup")) ok("setup.sh does not install or modify pi-setup");

console.log("\n=== Result ===");
if (errors.length) {
  for (const error of errors) console.error(`❌ ${error}`);
  console.error(`\n${errors.length} problem(s) found`);
  process.exit(1);
}
console.log("✅ all checks passed");
