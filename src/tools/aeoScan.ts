import { JackpotApiClient } from "../api/client.js";

export const aeoScanTool = {
  name: "jackpotkeywords_aeo_scan",
  description:
    "Run an AI-visibility scan for a product URL. Asks 10 buyer-intent queries against Gemini's " +
    "grounded search and reports, per query: whether the URL was cited as a source, mentioned in " +
    "the answer text, or absent — plus the top sources the AI did cite. " +
    "Costs $1.00 per scan (100¢). Refunded automatically on failure. Latency ~30–120 seconds.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Product URL to scan (e.g., https://yourproduct.com). Required.",
      },
      productContext: {
        type: "object",
        description:
          "Optional pre-extracted product context. If omitted we run extraction internally (free for caller, $1.00 flat). " +
          "Pass this only if you've already called /v1/recommend or have a known-good ProductContext.",
        additionalProperties: true,
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
} as const;

interface AeoScanArgs {
  url: string;
  productContext?: Record<string, unknown>;
}

interface AeoQuery {
  query: string;
  productCited: boolean;
  productMentionedInAnswer: boolean;
  answerSnippet?: string;
  citations: Array<{ url: string; title?: string }>;
}

interface AeoScanResponse {
  url: string;
  productName?: string;
  visibilityScore: number;
  queriesChecked: number;
  queriesCited: number;
  queriesMentioned: number;
  queries: AeoQuery[];
  balanceCents: number;
  executionTimeMs: number;
}

export async function runAeoScan(
  api: JackpotApiClient,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: AeoScanResponse;
}> {
  const a = args as unknown as AeoScanArgs;
  if (!a.url) {
    throw new Error("`url` is required.");
  }

  const body: Record<string, unknown> = { url: a.url };
  if (a.productContext) body.productContext = a.productContext;

  const data = await api.post<AeoScanResponse>("/aeo-scan", body);

  const lines: string[] = [];
  lines.push(`AEO scan of ${data.url}`);
  if (data.productName) lines.push(`Product: ${data.productName}`);
  lines.push(
    `Visibility score: ${data.visibilityScore}/100  ` +
      `(${data.queriesCited}/${data.queriesChecked} cited, ` +
      `${data.queriesMentioned}/${data.queriesChecked} mentioned)`,
  );
  lines.push(`Runtime: ${Math.round(data.executionTimeMs / 1000)}s. Balance: ${data.balanceCents}¢.`);
  lines.push("");
  lines.push("Per-query results:");

  for (let i = 0; i < data.queries.length; i++) {
    const q = data.queries[i];
    const status = q.productCited
      ? "CITED"
      : q.productMentionedInAnswer
        ? "MENTIONED"
        : "MISSING";
    lines.push(`  ${i + 1}. [${status}] "${q.query}"`);
    if (q.answerSnippet) {
      const snippet = q.answerSnippet.replace(/\s+/g, " ").slice(0, 200);
      lines.push(`     → ${snippet}${q.answerSnippet.length > 200 ? "…" : ""}`);
    }
    if (q.citations && q.citations.length > 0) {
      const top = q.citations.slice(0, 3).map((c) => c.url);
      lines.push(`     Sources cited: ${top.join(", ")}`);
    }
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
