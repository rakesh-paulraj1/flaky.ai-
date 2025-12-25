export class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T }> {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers = new Headers(options.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("Content-Type", "application/json");

    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Request failed");
    }
    const data = await response.json();
    return { data };
  }

  async get<T>(path: string): Promise<{ data: T }> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<{ data: T }> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

const apiClient = new ApiClient();
export default apiClient;
