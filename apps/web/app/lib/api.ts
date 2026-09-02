import type { CloudPage, SessionUser } from "./types";
import { localApi, isDesktop } from "./local-first";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message ?? "Não foi possível concluir a operação.");
  return payload as T;
}

export type SessionUser = { id: string; email: string; username: string; display_name: string; role: string };

export const remoteApi = {
  health: () => request<{ status: string }>("/health"),
  me: () => request<{ user: SessionUser }>("/auth/me"),
  login: (loginStr: string, password: string) => request<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ login: loginStr, password }) }),
  register: (email: string, username: string, password: string) => request<{ user: SessionUser }>("/auth/register", { method: "POST", body: JSON.stringify({ email, username, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  pages: () => request<CloudPage[]>("/api/pages"),
  createPage: (input: { title: string; icon?: string; content?: CloudPage["content"] }) =>
    request<CloudPage>("/api/pages", { method: "POST", body: JSON.stringify(input) }),
  updatePage: (id: string, input: { title?: string; content?: CloudPage["content"]; isFavorite?: boolean }) =>
    request<CloudPage>("/api/pages/" + id, { method: "PATCH", body: JSON.stringify(input) }),
  files: () => request<Array<{ id: string; original_name: string; mime_type: string; size_bytes: number; created_at: string }>>("/api/files"),
  fileUrl: (id: string) => API_URL + "/api/files/" + encodeURIComponent(id),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string; original_name: string; mime_type: string; size_bytes: number }>("/api/files", { method: "POST", body: form });
  },
};

// Proxy para direcionar as chamadas para o motor correto (Local-First no Desktop, Remote na Web)
export const api = new Proxy(remoteApi, {
  get(target, prop: keyof typeof remoteApi) {
    if (isDesktop() && prop in localApi) {
      // @ts-ignore
      return localApi[prop];
    }
    return target[prop];
  }
});
