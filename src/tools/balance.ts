import { JackpotApiClient } from "../api/client.js";

export const balanceTool = {
  name: "jackpotkeywords_credit_balance",
  description:
    "Return the current JackpotKeywords credit balance for the authenticated account. " +
    "Use this before calling /recommend or /aeo-scan to verify the account has credits available.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
} as const;

interface MeResponse {
  customerId: string;
  email: string;
  balanceCents: number;
  balanceUsd: string;
  lifetimeDepositedCents: number;
}

export async function runBalance(api: JackpotApiClient): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: MeResponse;
}> {
  const data = await api.get<MeResponse>("/me");

  const balanceUsd = data.balanceUsd ?? (data.balanceCents / 100).toFixed(2);
  const lifetimeUsd = (data.lifetimeDepositedCents / 100).toFixed(2);
  const text = [
    `Account: ${data.email}`,
    `Balance: $${balanceUsd} (${data.balanceCents}¢)`,
    `Lifetime topped up: $${lifetimeUsd}`,
    "",
    `At current pricing your balance covers:`,
    `  • ${Math.floor(data.balanceCents / 10)} /v1/recommend calls (10¢ each)`,
    `  • ${Math.floor(data.balanceCents / 100)} /v1/aeo-scan calls ($1.00 each)`,
  ].join("\n");

  return {
    content: [{ type: "text", text }],
    structuredContent: data,
  };
}
