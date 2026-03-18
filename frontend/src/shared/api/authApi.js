import { apiFetch } from "@/shared/api/httpClient";

export async function loginWithPassword({ email, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerAccount(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentSession() {
  return apiFetch("/auth/me", { allowUnauthorized: true });
}

export async function requestPasswordReset(email) {
  return apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordWithToken({ token, password }) {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function logoutSession() {
  return apiFetch("/auth/logout", { method: "POST" });
}
