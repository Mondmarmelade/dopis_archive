import type {
  EmailDetail,
  EmailSummary,
  LoginPayload,
  LoginResponse,
} from "./types";

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}

export class DopisApiClient {
  private baseUrl: string;
  private getToken: () => string | null | Promise<string | null>;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, "");
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error("Unauthorized. Please check credentials or log in again.");
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorMsg = errorJson.error;
        }
      } catch {
        // use default errorMsg
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // --- Auth ---
  public async login(payload: LoginPayload): Promise<LoginResponse> {
    const url = `${this.baseUrl}/api/auth/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as LoginResponse;
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Login failed.");
    }
    return data;
  }

  // --- Emails ---
  public async getEmails(folder: string = "inbox"): Promise<EmailSummary[]> {
    const res = await this.request<{ emails: EmailSummary[] } | EmailSummary[]>(
      `/api/emails?folder=${encodeURIComponent(folder)}`
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).emails)) return (res as any).emails;
    return [];
  }

  public async getEmail(id: string | number, folder: string = "inbox"): Promise<EmailDetail> {
    return this.request<EmailDetail>(
      `/api/email?id=${encodeURIComponent(id)}&folder=${encodeURIComponent(folder)}`
    );
  }

  // --- Actions ---
  public async archiveEmail(id: string | number, folder: string = "inbox"): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/archive`, {
      method: "POST",
      body: JSON.stringify({ id, folder }),
    });
  }

  public async trashEmail(id: string | number, folder: string = "inbox"): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/trash`, {
      method: "POST",
      body: JSON.stringify({ id, folder }),
    });
  }

  public async toggleFlag(
    id: string | number,
    flag: string,
    state: boolean,
    folder: string = "inbox"
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/flags`, {
      method: "POST",
      body: JSON.stringify({ id, flag, state, folder }),
    });
  }

  // --- AI ---
  public async testAi(prompt: string): Promise<{ reply?: string; result?: any }> {
    return this.request<{ reply?: string; result?: any }>(`/api/ai/test`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }
}
