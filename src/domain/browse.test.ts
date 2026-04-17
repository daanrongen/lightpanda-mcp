import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { LightpandaClientTest } from "../infra/LightpandaClientTest.ts";
import { LightpandaClient } from "./LightpandaClient.ts";

describe("navigate", () => {
  it("returns PageContent with the given url", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        return yield* client.navigate("https://example.com");
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(result.url).toBe("https://example.com");
    expect(result.title).toBeTruthy();
    expect(result.links.length).toBeGreaterThan(0);
  });

  it("getContent returns the current page after navigate", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        yield* client.navigate("https://example.com");
        return yield* client.getContent();
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(result.url).toBe("https://example.com");
  });

  it("click completes without error", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        return yield* client.click("button#submit");
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(result).toBeUndefined();
  });

  it("fill completes without error", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        return yield* client.fill("input[name='q']", "hello");
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(result).toBeUndefined();
  });

  it("screenshot returns a base64 string", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        return yield* client.screenshot();
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("evaluate returns JSON-serialized result", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* LightpandaClient;
        return yield* client.evaluate("1 + 1");
      }).pipe(Effect.provide(LightpandaClientTest)),
    );
    expect(result).toBe("2");
  });
});
