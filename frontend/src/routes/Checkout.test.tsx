import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../api/addresses";
import { listAddresses } from "../api/addresses";
import authReducer from "../store/auth-slice";
import cartReducer from "../store/cart-slice";
import { Checkout } from "./Checkout";

vi.mock("../api/addresses", () => ({
  listAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

vi.mock("../api/orders", () => ({ placeOrder: vi.fn() }));
vi.mock("../api/auth", () => ({ updateProfile: vi.fn() }));

const mockedList = vi.mocked(listAddresses);

const CACHE_KEY = "swiftbite:cached-addresses:user-1";

const cached: Address[] = [
  {
    id: "a1",
    label: "Home",
    street: "1 Main St",
    area: "Downtown",
    createdAt: "2026-01-01",
  },
];

const live: Address[] = [
  {
    id: "a2",
    label: "Work",
    street: "9 Office Rd",
    area: "Uptown",
    createdAt: "2026-02-01",
  },
];

function renderCheckout() {
  const testStore = configureStore({
    reducer: { auth: authReducer, cart: cartReducer },
    preloadedState: {
      auth: {
        user: {
          id: "user-1",
          name: "Buyer",
          email: "b@x.com",
          phone: "12345678",
          role: "customer",
        },
        token: "tok",
      },
      cart: {
        lines: [
          {
            menuItemId: "m1",
            name: "Noodles",
            price: 10,
            imageUrl: "",
            quantity: 1,
          },
        ],
      },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: () => 0 } },
  });
  return render(
    <Provider store={testStore}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Checkout />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

function modal() {
  const heading = screen.getByText("Choose address");
  const root = heading.closest("div.fixed");
  if (!root) throw new Error("address modal not found");
  return within(root as HTMLElement);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Checkout stale addresses", () => {
  it("shows live addresses with no warning and writes the cache on first load", async () => {
    mockedList.mockResolvedValue(live);
    renderCheckout();

    expect(await screen.findByText("Work")).toBeInTheDocument();
    expect(
      screen.queryByText(/Showing saved addresses from earlier/),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(live);

    fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    const dialog = modal();
    expect(
      dialog.queryByText(/Address changes are unavailable/),
    ).not.toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(
      dialog.getByRole("button", { name: /Add a new address/ }),
    ).toBeEnabled();
  });

  it("shows cached addresses with a stale warning and keeps ordering enabled", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    mockedList.mockRejectedValue(new Error("auth down"));
    renderCheckout();

    expect(
      await screen.findByText(/Showing saved addresses from earlier/),
    ).toBeInTheDocument();
    expect(mockedList.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place order/ })).toBeEnabled();
  });

  it("disables add and edit in the modal but still allows picking", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    mockedList.mockRejectedValue(new Error("auth down"));
    renderCheckout();
    await screen.findByText(/Showing saved addresses from earlier/);

    fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    const dialog = modal();
    expect(
      dialog.getByText(/Address changes are unavailable/),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(
      dialog.getByRole("button", { name: /Add a new address/ }),
    ).toBeDisabled();

    const pick = dialog.getByRole("button", { name: "Deliver to Home" });
    expect(pick).toBeEnabled();
    fireEvent.click(pick);
    expect(screen.queryByText("Choose address")).not.toBeInTheDocument();
  });

  it("retry replaces the cache with live data and clears the warning", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    mockedList.mockRejectedValue(new Error("auth down"));
    renderCheckout();
    await screen.findByText(/Showing saved addresses from earlier/);

    mockedList.mockResolvedValue(live);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Work")).toBeInTheDocument();
    expect(
      screen.queryByText(/Showing saved addresses from earlier/),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(live);
  });

  it("keeps the dead-end message with a retry action when nothing is cached", async () => {
    mockedList.mockRejectedValue(new Error("auth down"));
    renderCheckout();

    expect(
      await screen.findByText(/Could not load addresses/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place order/ })).toBeDisabled();
  });
});
