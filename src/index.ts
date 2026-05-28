#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { JackpotApiClient, JackpotApiError } from "./api/client.js";
import { balanceTool, runBalance } from "./tools/balance.js";
import { recommendTool, runRecommend } from "./tools/recommend.js";
import { recommendDeepTool, runRecommendDeep } from "./tools/recommendDeep.js";
import { auditTool, runAudit } from "./tools/audit.js";
import { aeoScanTool, runAeoScan } from "./tools/aeoScan.js";

const SERVER_NAME = "jackpotkeywords";
const SERVER_VERSION = "0.2.0";

function readEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    process.stderr.write(
      `[jackpotkeywords-mcp] ${name} is not set. Generate a key at https://jackpotkeywords.web.app/developers and set it in your MCP client config.\n`,
    );
    process.exit(1);
  }
  return value ?? "";
}

async function main(): Promise<void> {
  const apiKey = readEnv("JACKPOTKEYWORDS_API_KEY");
  const baseUrl = process.env.JACKPOTKEYWORDS_API_BASE;

  const api = new JackpotApiClient({ apiKey, baseUrl });

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  const tools: Tool[] = [
    balanceTool as unknown as Tool,
    recommendTool as unknown as Tool,
    recommendDeepTool as unknown as Tool,
    auditTool as unknown as Tool,
    aeoScanTool as unknown as Tool,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case balanceTool.name:
          return await runBalance(api);
        case recommendTool.name:
          return await runRecommend(api, args ?? {});
        case recommendDeepTool.name:
          return await runRecommendDeep(api, args ?? {});
        case auditTool.name:
          return await runAudit(api, args ?? {});
        case aeoScanTool.name:
          return await runAeoScan(api, args ?? {});
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      if (err instanceof JackpotApiError) {
        return errorResult(err.message);
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function errorResult(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

main().catch((err) => {
  process.stderr.write(
    `[jackpotkeywords-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
