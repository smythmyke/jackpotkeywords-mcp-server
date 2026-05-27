// Local integration test for jackpotkeywords-mcp-server.
//
// Spawns the built server as a subprocess, talks MCP JSON-RPC over stdio,
// and verifies:
//   1. initialize handshake works
//   2. tools/list returns all 3 tools
//   3. tools/call for jackpotkeywords_credit_balance succeeds against prod
//      (free — just GET /v1/me)
//
// Auth: signs up a fresh test API key against prod /v1/signup so the test
// is hermetic. The new customer gets $5 in starter credit; we only spend $0
// (balance call doesn't deduct).
//
// Usage:
//   cd mcp-server && npm run build && node scripts/local-test.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");
const API_BASE = "https://jackpotkeywords.web.app/api/v1";

async function signupFreshKey() {
  const email = `mcp-test-${Date.now()}@example.com`;
  console.log(`[setup] Signing up fresh test account: ${email}`);
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`Signup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  console.log(`[setup] Got key prefix ${body.apiKey.slice(0, 16)}… ($${(body.balanceCents / 100).toFixed(2)} credit)`);
  return body.apiKey;
}

async function runMcpTest(apiKey) {
  console.log(`[mcp] Spawning ${SERVER_PATH}`);
  const proc = spawn("node", [SERVER_PATH], {
    env: { ...process.env, JACKPOTKEYWORDS_API_KEY: apiKey },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  proc.stderr.on("data", (d) => {
    stderr += d.toString();
    process.stderr.write(`[server stderr] ${d}`);
  });

  // MCP uses newline-delimited JSON-RPC over stdio
  const responses = new Map();
  let buffer = "";

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined) responses.set(msg.id, msg);
      } catch (e) {
        console.warn(`[mcp] Non-JSON output: ${line}`);
      }
    }
  });

  function send(method, params, id) {
    const msg = { jsonrpc: "2.0", id, method, params };
    proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  async function waitFor(id, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (responses.has(id)) return responses.get(id);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for response id=${id}`);
  }

  function assert(cond, msg) {
    if (!cond) {
      console.error(`  ❌ ${msg}`);
      proc.kill();
      process.exit(1);
    }
    console.log(`  ✓ ${msg}`);
  }

  try {
    // 1. Initialize
    console.log("\n[1/3] initialize");
    send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "local-test", version: "0.0.1" },
    }, 1);
    const initResp = await waitFor(1);
    assert(initResp.result, "initialize returned a result");
    assert(initResp.result.serverInfo?.name === "jackpotkeywords",
      `server identifies as "jackpotkeywords" (got "${initResp.result.serverInfo?.name}")`);
    console.log(`  server version: ${initResp.result.serverInfo?.version}`);

    // 2. List tools
    console.log("\n[2/3] tools/list");
    send("tools/list", {}, 2);
    const listResp = await waitFor(2);
    assert(Array.isArray(listResp.result?.tools), "tools/list returned an array");
    const names = listResp.result.tools.map((t) => t.name);
    console.log(`  tools: ${names.join(", ")}`);
    assert(names.includes("jackpotkeywords_credit_balance"), "balance tool present");
    assert(names.includes("jackpotkeywords_recommend"), "recommend tool present");
    assert(names.includes("jackpotkeywords_aeo_scan"), "aeo_scan tool present");
    assert(names.length === 3, "exactly 3 tools registered");

    // 3. Call balance (free)
    console.log("\n[3/3] tools/call jackpotkeywords_credit_balance");
    send("tools/call", {
      name: "jackpotkeywords_credit_balance",
      arguments: {},
    }, 3);
    const callResp = await waitFor(3, 15000);
    assert(callResp.result, "balance call returned a result");
    assert(!callResp.result.isError, "balance call did not error");
    const text = callResp.result.content?.[0]?.text || "";
    console.log(`\n${text.split("\n").map((l) => `  | ${l}`).join("\n")}\n`);
    const struct = callResp.result.structuredContent;
    assert(struct?.balanceCents === 500, "structured balance is 500 cents (fresh signup)");
    assert(struct?.email, "structured email present");

    console.log("\n✅ All checks passed. MCP server is wired correctly end-to-end.\n");
  } finally {
    proc.kill();
  }
}

(async () => {
  try {
    const apiKey = await signupFreshKey();
    await runMcpTest(apiKey);
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    process.exit(1);
  }
})();
