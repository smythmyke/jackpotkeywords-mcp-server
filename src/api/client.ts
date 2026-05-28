// Uses the direct Cloud Function URL rather than the jackpotkeywords.web.app
// Hosting rewrite — Firebase Hosting kills proxied requests at 60s, but
// /v1/recommend and /v1/aeo-scan routinely take 30-180s. The direct URL has
// no edge timeout. See incident 2026-05-25.
const DEFAULT_API_BASE = "https://us-central1-even-plate-378520.cloudfunctions.net/api/api/v1";
const USER_AGENT = "jackpotkeywords-mcp-server/0.2.0";

export interface ApiClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class JackpotApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "JackpotApiError";
  }
}

export class JackpotApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: ApiClientOptions) {
    if (!opts.apiKey) {
      throw new Error("JACKPOTKEYWORDS_API_KEY is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_API_BASE).replace(/\/$/, "");
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: text };
    }

    if (!res.ok) {
      const errBody = parsed as { error?: string; message?: string };
      const rawMessage = errBody.message ?? errBody.error ?? `HTTP ${res.status}`;
      throw new JackpotApiError(
        humanizeError(res.status, rawMessage),
        res.status,
        codeForStatus(res.status),
      );
    }

    return parsed as T;
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case 401:
      return "unauthenticated";
    case 402:
      return "payment_required";
    case 403:
      return "permission_denied";
    case 404:
      return "not_found";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server_error" : "bad_request";
  }
}

function humanizeError(status: number, message: string): string {
  switch (status) {
    case 401:
      return "Invalid or missing JACKPOTKEYWORDS_API_KEY. Generate a new key at https://jackpotkeywords.web.app/developers";
    case 402:
      return `${message} Top up at https://jackpotkeywords.web.app/developers — call POST /v1/topup, or visit your dashboard.`;
    case 429:
      return "Rate limit exceeded (60/min, 1000/hr per key). Wait briefly and retry.";
    default:
      return message;
  }
}
