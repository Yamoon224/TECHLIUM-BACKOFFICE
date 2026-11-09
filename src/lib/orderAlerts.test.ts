import { describe, expect, it } from "vitest";
import { newOrders } from "./orderAlerts";
import type { Order } from "./orders";

const order = (order_number: string) => ({ order_number }) as Order;

describe("newOrders", () => {
  it("returns the unseen orders, oldest first", () => {
    const list = [order("C3"), order("C2"), order("C1")];
    expect(newOrders(list, new Set(["C1"])).map((o) => o.order_number)).toEqual(["C2", "C3"]);
  });

  it("returns nothing when every order is known", () => {
    expect(newOrders([order("C1")], new Set(["C1"]))).toEqual([]);
  });
});
