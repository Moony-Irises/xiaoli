import type {
  McpServer,
  RegisteredTool,
  ToolCallback
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";
import {
  AgentCoreToolId,
  getToolCatalogEntry
} from "./tool-catalog.js";

export function registerAgentCoreTool<Args extends ZodRawShape>(
  server: McpServer,
  toolId: AgentCoreToolId,
  inputSchema: Args,
  handler: ToolCallback<Args>
): RegisteredTool {
  const entry = getToolCatalogEntry(toolId);
  if (!entry) throw new Error(`Agent core tool '${toolId}' is missing from the catalog`);

  return server.tool(entry.id, entry.description, inputSchema, handler);
}
