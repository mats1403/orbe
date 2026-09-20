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
  getVaults: (): string[] => [],
  setActiveVault: (path: string) => {},
  setupVault: () => Promise.resolve(null as string | null),
  getVaultPath: () => null as string | null,
  health: () => request<{ status: string }>("/health"),
  me: () => request<{ user: SessionUser }>("/auth/me"),
  patchMe: (vault_path?: string | null, last_opened_files?: string | null) => request<{ user: SessionUser }>("/auth/me", { method: "PATCH", body: JSON.stringify({ vault_path, last_opened_files }) }),
  login: (loginStr: string, password: string) => request<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ login: loginStr, password }) }),
  register: (email: string, username: string, password: string) => request<{ user: SessionUser }>("/auth/register", { method: "POST", body: JSON.stringify({ email, username, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  // Mock implementations for local-first fallbacks
  pages: () => Promise.resolve([]),
  createPage: () => Promise.reject(new Error("Local only")),
  updatePage: () => Promise.reject(new Error("Local only")),
  deletePage: () => Promise.reject(new Error("Local only")),
  files: () => Promise.resolve([]),
  fileUrl: () => "",
  upload: () => Promise.reject(new Error("Local only")),
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
