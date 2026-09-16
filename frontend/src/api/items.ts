import { apiFetch } from "./client";

const ITEM_URL = import.meta.env.VITE_ITEM_URL ?? "/api/items";

export interface Category {
  id: string;
  name: string;
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

export function listItems(categoryId?: string) {
  const query = categoryId ? `?category_id=${categoryId}` : "";
  return apiFetch(`${ITEM_URL}/items${query}`) as Promise<MenuItem[]>;
}
