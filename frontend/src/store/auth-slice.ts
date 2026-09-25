import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

function loadPersisted(): AuthState {
  try {
    const raw = localStorage.getItem("swiftbite-auth");
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // corrupted storage, start logged out
  }
  return { user: null, token: null };
}

const authSlice = createSlice({
  name: "auth",
  initialState: loadPersisted(),
  reducers: {
    setSession(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearSession(state) {
      state.user = null;
      state.token = null;
    },
  },
});

export const { setSession, updateUser, clearSession } = authSlice.actions;
export default authSlice.reducer;
