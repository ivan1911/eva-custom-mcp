import { randomUUID } from "node:crypto";

interface EvaJsonRpcResponse<T> {
  jsonrpc?: string;
  result?: T;
  error?: {
    code?: string | number;
    message?: string;
  };
  callid?: string;
}

export interface EvaRpcRequest {
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  fields?: string[];
  filter?: unknown[];
  flags?: Record<string, unknown>;
  noMeta?: boolean;
}

export class EvaTeamClient {
  readonly origin: string;

  constructor(
    private baseUrl: string,
    private apiToken?: string,
  ) {
    this.origin = new URL(baseUrl).origin;
  }

  resolveUrl(pathOrUrl: string): string {
    return new URL(pathOrUrl, `${this.baseUrl}/`).toString();
  }

  private headers(): Record<string, string> {
    return {
      ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      "Content-Type": "application/json",
    };
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async getText(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.text();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async postForm(pathOrUrl: string, body: FormData): Promise<unknown> {
    const res = await fetch(this.resolveUrl(pathOrUrl), {
      method: "POST",
      headers: {
        ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`POST ${pathOrUrl} failed: ${res.status} ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async rpc<T>(method: string, params: EvaRpcRequest = {}): Promise<T> {
    const body = {
      jsonrpc: "2.2",
      method,
      callid: randomUUID(),
      ...(params.args ? { args: params.args } : {}),
      ...(params.kwargs ? { kwargs: params.kwargs } : {}),
      ...(params.fields ? { fields: params.fields } : {}),
      ...(params.filter ? { filter: params.filter } : {}),
      ...(params.flags ? { flags: params.flags } : {}),
      ...(params.noMeta !== undefined ? { no_meta: params.noMeta } : {}),
    };

    const response = await this.post<EvaJsonRpcResponse<T>>(`/api/?m=${encodeURIComponent(method)}`, body);
    if (response.error) {
      const code = response.error.code ? ` ${response.error.code}` : "";
      throw new Error(`${method} failed:${code} ${response.error.message ?? "Unknown EvaTeam API error"}`);
    }

    return response.result as T;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`DELETE ${path} failed: ${res.status} ${await res.text()}`);
    }
  }
}
