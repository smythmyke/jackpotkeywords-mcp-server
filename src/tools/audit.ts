import { JackpotApiClient } from "../api/client.js";

export const auditTool = {
  name: "jackpotkeywords_audit",
  description:
    "Run an SEO audit on a URL. Crawls the primary page plus up to 8 priority secondary pages, " +
    "checks technical / content / crawlability / structured-data / local / social-sharing categories, " +
    "and returns scored checks, per-page issues, keyword gaps, and prioritized recommendations. " +
    "AEO (AI-visibility) data is intentionally NOT bundled — call jackpotkeywords_aeo_scan for that. " +
    "Costs $0.50 per audit (50¢). Refunded automatically on failure. Latency ~20–60 seconds.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to audit (e.g., https://yourproduct.com or yourproduct.com). Required.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
} as const;

interface AuditArgs {
  url: string;
}

interface AuditCheckItem {
  id: string;
  category: string;
  status: "pass" | "warning" | "fail" | string;
  label: string;
  recommendation?: string;
}

interface AuditPageResult {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  issues?: AuditCheckItem[];
}

interface AuditKeywordGap {
  keyword: string;
  opportunity: string;
  difficulty?: string;
  sampleKeywords?: string[];
}

interface AuditRecommendation {
  title: string;
  description: string;
  priority?: string;
}

interface AuditResponse {
  url: string;
  domain: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  checks: AuditCheckItem[];
  pageResults: AuditPageResult[];
  keywordGaps: AuditKeywordGap[];
  recommendations: AuditRecommendation[];
  metadata: {
    pagesAnalyzed: number;
    executionTimeMs: number;
  };
  balanceCents: number;
  executionTimeMs: number;
}

export async function runAudit(
  api: JackpotApiClient,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: AuditResponse;
}> {
  const a = args as unknown as AuditArgs;
  if (!a.url) {
    throw new Error("`url` is required.");
  }

  const data = await api.post<AuditResponse>("/audit", { url: a.url });

  const lines: string[] = [];
  lines.push(`SEO audit of ${data.url}`);
  lines.push(
    `Overall score: ${data.overallScore}/100  ` +
      `(${data.metadata.pagesAnalyzed} pages, ${Math.round(data.executionTimeMs / 1000)}s). ` +
      `Balance: ${data.balanceCents}¢.`,
  );

  if (data.categoryScores) {
    lines.push("");
    lines.push("Category scores:");
    for (const [cat, score] of Object.entries(data.categoryScores)) {
      lines.push(`  ${cat}: ${score}/100`);
    }
  }

  const failCount = data.checks.filter((c) => c.status === "fail").length;
  const warnCount = data.checks.filter((c) => c.status === "warning").length;
  const passCount = data.checks.filter((c) => c.status === "pass").length;
  lines.push("");
  lines.push(`Check summary: ${passCount} pass, ${warnCount} warning, ${failCount} fail`);

  const topIssues = data.checks
    .filter((c) => c.status === "fail" || c.status === "warning")
    .slice(0, 8);
  if (topIssues.length > 0) {
    lines.push("");
    lines.push("Top issues:");
    for (const issue of topIssues) {
      lines.push(`  [${issue.status.toUpperCase()}] ${issue.category}: ${issue.label}`);
      if (issue.recommendation) {
        const rec = issue.recommendation.replace(/\s+/g, " ").slice(0, 180);
        lines.push(`     → ${rec}${issue.recommendation.length > 180 ? "…" : ""}`);
      }
    }
  }

  if (data.keywordGaps && data.keywordGaps.length > 0) {
    lines.push("");
    lines.push(`Keyword gaps (${data.keywordGaps.length}):`);
    for (const gap of data.keywordGaps.slice(0, 6)) {
      const diff = gap.difficulty ? ` [${gap.difficulty}]` : "";
      lines.push(`  "${gap.keyword}"${diff} — ${gap.opportunity}`);
    }
  }

  if (data.recommendations && data.recommendations.length > 0) {
    lines.push("");
    lines.push(`Prioritized recommendations (${data.recommendations.length}):`);
    for (const rec of data.recommendations.slice(0, 6)) {
      const pri = rec.priority ? `[${rec.priority}] ` : "";
      lines.push(`  ${pri}${rec.title}`);
      if (rec.description) {
        const desc = rec.description.replace(/\s+/g, " ").slice(0, 200);
        lines.push(`     ${desc}${rec.description.length > 200 ? "…" : ""}`);
      }
    }
  }

  lines.push("");
  lines.push("(full check list, per-page results, and all gaps/recs in structuredContent)");

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
