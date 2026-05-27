import { JackpotApiClient } from "../api/client.js";

export const recommendTool = {
  name: "jackpotkeywords_recommend",
  description:
    "Run the full keyword research pipeline for a product and return ranked keyword " +
    "recommendations by composite Jackpot Score (volume, CPC, competition, trend, cluster strength, " +
    "AI relevance). Backed by real Google Ads Keyword Planner data. " +
    "Costs $0.10 per call (10¢, regardless of limit). Refunded automatically on pipeline failure. " +
    "Latency ~60–180 seconds — agents should set generous timeouts.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Product URL to extract context from (e.g., https://yourproduct.com). At least one of url/description required.",
      },
      description: {
        type: "string",
        description: "Plain-English description of the product (e.g., 'AI keyword research tool for indie makers'). At least one of url/description required.",
      },
      limit: {
        type: "number",
        description: "Maximum recommendations to return. Default 50, max 200. Cost is flat regardless.",
        minimum: 1,
        maximum: 200,
      },
      budget: {
        type: "number",
        description: "Optional daily ad budget in USD. Influences AI scoring/intent classification.",
      },
      location: {
        type: "string",
        description: "Optional location for local-intent boosting (e.g., 'San Francisco, CA').",
      },
    },
    additionalProperties: false,
  },
} as const;

interface RecommendArgs {
  url?: string;
  description?: string;
  limit?: number;
  budget?: number;
  location?: string;
}

interface Recommendation {
  keyword: string;
  monthlyVolume: number;
  lowCpc: number;
  highCpc: number;
  competition: string;
  jackpotScore: number;
  intent?: string;
  category?: string;
  trendDirection?: string;
  suggestHits?: number;
}

interface RecommendResponse {
  productName?: string;
  query?: string;
  url?: string;
  recommendations: Recommendation[];
  totalCandidates: number;
  returned: number;
  balanceCents: number;
  executionTimeMs: number;
}

export async function runRecommend(
  api: JackpotApiClient,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: RecommendResponse;
}> {
  const a = args as unknown as RecommendArgs;
  if (!a.url && !a.description) {
    throw new Error("Provide at least one of `url` or `description`.");
  }

  const body: Record<string, unknown> = {};
  if (a.url) body.url = a.url;
  if (a.description) body.description = a.description;
  if (typeof a.limit === "number") body.limit = a.limit;
  if (typeof a.budget === "number") body.budget = a.budget;
  if (a.location) body.location = a.location;

  const data = await api.post<RecommendResponse>("/recommend", body);

  const lines: string[] = [];
  if (data.productName) lines.push(`Product: ${data.productName}`);
  lines.push(
    `Returned ${data.returned} of ${data.totalCandidates} candidate keywords ` +
      `in ${Math.round(data.executionTimeMs / 1000)}s. Balance: ${data.balanceCents}¢.`,
  );
  lines.push("");
  lines.push("Top recommendations (ranked by Jackpot Score):");

  for (const rec of data.recommendations.slice(0, 25)) {
    const vol = rec.monthlyVolume?.toLocaleString() ?? "?";
    const cpc =
      rec.lowCpc != null && rec.highCpc != null
        ? `$${rec.lowCpc.toFixed(2)}–$${rec.highCpc.toFixed(2)}`
        : "no CPC";
    const meta = [
      rec.competition,
      rec.intent,
      rec.category,
      rec.trendDirection ? `trend ${rec.trendDirection}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `  ${rec.jackpotScore?.toFixed?.(0) ?? rec.jackpotScore}/100 · "${rec.keyword}" · ` +
        `vol ${vol}/mo · ${cpc}` +
        (meta ? ` · ${meta}` : ""),
    );
  }
  if (data.recommendations.length > 25) {
    lines.push(`  … and ${data.recommendations.length - 25} more (see structuredContent)`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
