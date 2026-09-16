import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
}

function loadPersisted(): CartState {
  try {
    const raw = localStorage.getItem("swiftbite-cart");
    if (raw) return JSON.parse(raw) as CartState;
  } catch {
    // corrupted storage, start empty
  }
  return { lines: [] };
}

const cartSlice = createSlice({
  name: "cart",
  initialState: loadPersisted(),
  reducers: {
    addLine(state, action: PayloadAction<Omit<CartLine, "quantity">>) {
      const existing = state.lines.find(
        (line) => line.menuItemId === action.payload.menuItemId,
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        state.lines.push({ ...action.payload, quantity: 1 });
      }
    },
    setQuantity(
      state,
      action: PayloadAction<{ menuItemId: string; quantity: number }>,
    ) {
      const line = state.lines.find(
        (l) => l.menuItemId === action.payload.menuItemId,
      );
      if (!line) return;
      if (action.payload.quantity <= 0) {
        state.lines = state.lines.filter(
          (l) => l.menuItemId !== action.payload.menuItemId,
        );
      } else {
        line.quantity = action.payload.quantity;
      }
    },
    clearCart(state) {
      state.lines = [];
    },
  },
});

export const { addLine, setQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
