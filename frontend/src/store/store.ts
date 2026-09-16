import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./auth-slice";
import cartReducer from "./cart-slice";

export const store = configureStore({
  reducer: { auth: authReducer, cart: cartReducer },
});

store.subscribe(() => {
  const { user, token } = store.getState().auth;
  if (user && token) {
    localStorage.setItem("swiftbite-auth", JSON.stringify({ user, token }));
  } else {
    localStorage.removeItem("swiftbite-auth");
  }
  localStorage.setItem("swiftbite-cart", JSON.stringify(store.getState().cart));
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
