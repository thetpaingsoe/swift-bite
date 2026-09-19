import { apiFetch } from "./client";

const ITEM_URL = import.meta.env.VITE_ITEM_URL ?? "/api/items";

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  available: boolean;
}

export function listCategories() {
  return apiFetch(`${ITEM_URL}/categories`) as Promise<Category[]>;
}

export function deleteCategory(id: string) {
  return apiFetch(`${ITEM_URL}/categories/${id}`, {
    method: "DELETE",
  }) as Promise<{ message: string }>;
}

export function createCategory(name: string) {
  return apiFetch(`${ITEM_URL}/categories`, {
    method: "POST",
    body: JSON.stringify({ name }),
  }) as Promise<Category>;
}

export function updateCategory(id: string, name: string) {
  return apiFetch(`${ITEM_URL}/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }) as Promise<Category>;
}

export function listItems(categoryId?: string) {
  const query = categoryId ? `?category_id=${categoryId}` : "";
  return apiFetch(`${ITEM_URL}/items${query}`) as Promise<MenuItem[]>;
}
