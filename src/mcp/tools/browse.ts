import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { LightpandaError } from "../../domain/errors.ts";
import { LightpandaClient } from "../../domain/LightpandaClient.ts";
import { formatImage, formatSuccess, runTool } from "../utils.ts";

export const registerBrowseTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<LightpandaClient, LightpandaError>,
) => {
  server.tool(
    "navigate",
    "Navigate to a URL and return the page content — title, text, and links. Uses Lightpanda headless browser for JS-rendered pages.",
    {
      url: z.string().describe("The URL to navigate to"),
      waitUntil: z
        .enum(["load", "networkidle0", "networkidle2"])
        .optional()
        .describe("When to consider navigation done (default: networkidle0)"),
    },
    {
      title: "Navigate to URL",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ url, waitUntil }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          return yield* client.navigate(url, waitUntil);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "get_content",
    "Get the current page content. Optionally scope to a CSS selector to extract a specific section.",
    {
      selector: z
        .string()
        .optional()
        .describe("CSS selector to scope content extraction (default: entire body)"),
    },
    {
      title: "Get Page Content",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ selector }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          return yield* client.getContent(selector);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "get_html",
    "Get the raw HTML of the current page or a specific element. Use this to discover CSS selectors before calling click or fill.",
    {
      selector: z
        .string()
        .optional()
        .describe("CSS selector of the element to retrieve (default: body)"),
    },
    {
      title: "Get HTML",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ selector }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          return yield* client.getHtml(selector);
        }),
        formatSuccess,
      ),
  );

  server.tool(
    "wait_for_selector",
    "Wait for a CSS selector to appear in the DOM before continuing. Use after click or fill when the page loads content dynamically.",
    {
      selector: z.string().describe("CSS selector to wait for"),
      timeout: z.number().optional().describe("Max wait time in milliseconds (default: 5000)"),
    },
    {
      title: "Wait for Selector",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ selector, timeout }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          yield* client.waitForSelector(selector, timeout);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "click",
    "Click an element on the current page by CSS selector.",
    {
      selector: z.string().describe("CSS selector of the element to click"),
    },
    {
      title: "Click Element",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ selector }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          yield* client.click(selector);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "fill",
    "Fill a form field on the current page by CSS selector.",
    {
      selector: z.string().describe("CSS selector of the input field to fill"),
      value: z.string().describe("The value to type into the field"),
    },
    {
      title: "Fill Form Field",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ selector, value }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          yield* client.fill(selector, value);
        }),
        () => formatSuccess({ ok: true }),
      ),
  );

  server.tool(
    "screenshot",
    "Capture a screenshot of the current page. Returns a base64-encoded PNG string.",
    {},
    {
      title: "Take Screenshot",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async () =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          return yield* client.screenshot();
        }),
        (base64) => formatImage(base64, "image/png"),
      ),
  );

  server.tool(
    "evaluate",
    "Evaluate a JavaScript expression in the context of the current page and return the JSON-serialized result.",
    {
      expression: z.string().describe("JavaScript expression to evaluate in the page context"),
    },
    {
      title: "Evaluate JavaScript",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ expression }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* LightpandaClient;
          return yield* client.evaluate(expression);
        }),
        (result) => formatSuccess({ result }),
      ),
  );
};
