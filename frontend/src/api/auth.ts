import { apiFetch } from "./client";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "/api/auth";

export interface AuthResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

export function login(email: string, password: string) {
  return apiFetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }) as Promise<AuthResponse>;
}

export function register(name: string, email: string, password: string) {
  return apiFetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  }) as Promise<AuthResponse>;
}

export function verify() {
  return apiFetch(`${AUTH_URL}/auth/verify`) as Promise<{
    userId: string;
    email: string;
  }>;
}

export interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function updateProfile(name: string) {
  return apiFetch(`${AUTH_URL}/auth/profile`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }) as Promise<ProfileResponse>;
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch(`${AUTH_URL}/auth/password`, {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  }) as Promise<{ success: boolean }>;
}
