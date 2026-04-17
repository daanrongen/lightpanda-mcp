import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import type { LightpandaError } from "../domain/errors.ts";
import type { LightpandaClient } from "../domain/LightpandaClient.ts";
import { registerBrowseTools } from "./tools/browse.ts";

export const createMcpServer = (
  runtime: ManagedRuntime.ManagedRuntime<LightpandaClient, LightpandaError>,
): McpServer => {
  const server = new McpServer({
    name: "lightpanda-mcp-server",
    version: "1.0.0",
  });

  registerBrowseTools(server, runtime);

  return server;
};
