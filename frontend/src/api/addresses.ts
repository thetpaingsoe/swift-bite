import { apiFetch } from "./client";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "/api/auth";

export interface Address {
  id: string;
  label: string;
  street: string;
  area: string;
  createdAt: string;
}

export interface AddressInput {
  label: string;
  street: string;
  area: string;
}

export function listAddresses() {
  return apiFetch(`${AUTH_URL}/addresses`) as Promise<Address[]>;
}

export function createAddress(input: AddressInput) {
  return apiFetch(`${AUTH_URL}/addresses`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as Promise<Address>;
}

export function updateAddress(id: string, input: Partial<AddressInput>) {
  return apiFetch(`${AUTH_URL}/addresses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }) as Promise<Address>;
}

export function deleteAddress(id: string) {
  return apiFetch(`${AUTH_URL}/addresses/${id}`, {
    method: "DELETE",
  }) as Promise<{ success: boolean }>;
}
