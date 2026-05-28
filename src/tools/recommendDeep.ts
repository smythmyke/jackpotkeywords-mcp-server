import { JackpotApiClient } from "../api/client.js";

export const recommendDeepTool = {
  name: "jackpotkeywords_recommend_deep",
  description:
    "Run the deep keyword research pipeline for a product. Same inputs as jackpotkeywords_recommend, " +
    "but also runs parallel competitor discovery (broadens the keyword set) and returns the cluster + " +
    "category + competitor-brand aggregates that the standard recommend tool discards. Use this when " +
    "you need to see WHICH keyword clusters matter and WHO else is ranking, in one call. " +
    "Costs $0.30 per call (30¢, regardless of limit). Refunded automatically on pipeline failure. " +
    "Latency ~75–200 seconds — agents should set generous timeouts.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Product URL to extract context from (e.g., https://yourproduct.com). At least one of url/description required.",
      },
      description: {
        type: "string",
        description: "Plain-English description of the product. At least one of url/description required.",
      },
      limit: {
        type: "number",
        description: "Maximum recommendations to return. Default 50, max 200. Clusters/categories/competitors are not truncated.",
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

interface RecommendDeepArgs {
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

interface Cluster {
  id?: string;
  name?: string;
  keywordCount?: number;
  totalVolume?: number;
  keywordKeys?: string[];
}

interface CategoryCount {
  category: string;
  count: number;
}

interface RecommendDeepResponse {
  productName?: string;
  query?: string;
  url?: string;
  recommendations: Recommendation[];
  clusters: Cluster[];
  categories: CategoryCount[];
  competitors: string[];
  totalCandidates: number;
  returned: number;
  balanceCents: number;
  executionTimeMs: number;
}

export async function runRecommendDeep(
  api: JackpotApiClient,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: RecommendDeepResponse;
}> {
  const a = args as unknown as RecommendDeepArgs;
  if (!a.url && !a.description) {
    throw new Error("Provide at least one of `url` or `description`.");
  }

  const body: Record<string, unknown> = {};
  if (a.url) body.url = a.url;
  if (a.description) body.description = a.description;
  if (typeof a.limit === "number") body.limit = a.limit;
  if (typeof a.budget === "number") body.budget = a.budget;
  if (a.location) body.location = a.location;

  const data = await api.post<RecommendDeepResponse>("/recommend-deep", body);

  const lines: string[] = [];
  if (data.productName) lines.push(`Product: ${data.productName}`);
  lines.push(
    `Returned ${data.returned} of ${data.totalCandidates} candidate keywords ` +
      `in ${Math.round(data.executionTimeMs / 1000)}s. Balance: ${data.balanceCents}¢.`,
  );

  if (data.competitors && data.competitors.length > 0) {
    lines.push("");
    lines.push(`Competitors detected: ${data.competitors.slice(0, 10).join(", ")}`);
  }

  if (data.categories && data.categories.length > 0) {
    lines.push("");
    lines.push("Category distribution:");
    for (const c of data.categories.slice(0, 8)) {
      lines.push(`  ${c.category}: ${c.count} keywords`);
    }
  }

  if (data.clusters && data.clusters.length > 0) {
    lines.push("");
    lines.push(`Top clusters (${data.clusters.length} total):`);
    const sortedClusters = [...data.clusters]
      .sort((a, b) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0))
      .slice(0, 8);
    for (const cl of sortedClusters) {
      const vol = cl.totalVolume?.toLocaleString() ?? "?";
      const count = cl.keywordCount ?? cl.keywordKeys?.length ?? 0;
      lines.push(`  "${cl.name ?? cl.id ?? "(unnamed)"}" — ${count} kw, total vol ${vol}/mo`);
    }
  }

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
