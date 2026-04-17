/**
 * Integration test for lightpanda-mcp
 *
 * Imports LightpandaClientLive directly and exercises navigate, getContent,
 * evaluate against a live Lightpanda browser server.
 *
 * Usage:
 *   LIGHTPANDA_URL=ws://raspberrypi:30922 bun integration-test.ts
 */

import net from "node:net";
import { Effect, Exit, ManagedRuntime } from "effect";
import { LightpandaClient } from "./src/domain/LightpandaClient.ts";
import { LightpandaClientLive } from "./src/infra/LightpandaClientLive.ts";

const LIGHTPANDA_URL = process.env.LIGHTPANDA_URL ?? "ws://raspberrypi:30922";
const TARGET_URL = "https://example.com";

// ─── helpers ─────────────────────────────────────────────────────────────────

const pad = (s: string, n = 20) => s.padEnd(n);

function pass(label: string, detail: string): void {
  console.log(`  PASS  ${pad(label)} ${detail}`);
}

function fail(label: string, detail: string): void {
  console.log(`  FAIL  ${pad(label)} ${detail}`);
}

// ─── reachability ─────────────────────────────────────────────────────────────

function checkReachable(wsUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = wsUrl.replace(/^wss?:\/\//, "");
    const [host, portStr] = url.split(":");
    const port = Number(portStr ?? 80);

    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(3000);
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// ─── test program ─────────────────────────────────────────────────────────────

const testProgram = Effect.gen(function* () {
  const client = yield* LightpandaClient;

  // navigate
  const navResult = yield* Effect.either(client.navigate(TARGET_URL));
  if (navResult._tag === "Right") {
    const p = navResult.right;
    pass("navigate", `title="${p.title}" url=${p.url}`);
  } else {
    fail("navigate", String(navResult.left));
  }

  // get_content
  const contentResult = yield* Effect.either(client.getContent());
  if (contentResult._tag === "Right") {
    const text = contentResult.right.text;
    const snippet = text.slice(0, 80).replace(/\s+/g, " ").trim();
    pass("get_content", `${text.length} chars — "${snippet}…"`);
  } else {
    fail("get_content", String(contentResult.left));
  }

  // evaluate
  const evalResult = yield* Effect.either(client.evaluate("document.title"));
  if (evalResult._tag === "Right") {
    pass("evaluate", `document.title = ${evalResult.right}`);
  } else {
    fail("evaluate", String(evalResult.left));
  }
});

// ─── main ─────────────────────────────────────────────────────────────────────

console.log("lightpanda-mcp integration test");
console.log("================================");
console.log(`LIGHTPANDA_URL = ${LIGHTPANDA_URL}`);
console.log(`TARGET_URL     = ${TARGET_URL}`);
console.log("");

// 1. Check raw TCP reachability
console.log("[ connectivity ]");
const reachable = await checkReachable(LIGHTPANDA_URL);
if (reachable) {
  pass("TCP reachable", LIGHTPANDA_URL);
} else {
  fail("TCP reachable", `cannot connect to ${LIGHTPANDA_URL}`);
  console.log("\nAborting — Lightpanda server unreachable.");
  process.exit(1);
}

console.log("");
console.log("[ browser tools ]");

// 2. Run Effect program via ManagedRuntime (mirrors main.ts pattern)
//    LIGHTPANDA_URL env var is already set, so Config.string("LIGHTPANDA_URL") resolves normally.
const runtime = ManagedRuntime.make(LightpandaClientLive);

const exit = await runtime.runPromiseExit(testProgram);

await runtime.runPromise(runtime.disposeEffect);

console.log("");
if (Exit.isSuccess(exit)) {
  console.log("Done — all tools exercised.");
} else {
  console.log("Test run failed with defect:");
  console.log(exit.cause);
  process.exit(1);
}
