import { describe, expect, it } from "vitest";

function isDuplicate(quantity: number): boolean {
  return quantity > 1;
}

function itemTotal(quantity: number, price: number): number {
  return quantity * price;
}

describe("collection rules", () => {
  it("considers quantity greater than one as duplicate", () => {
    expect(isDuplicate(1)).toBe(false);
    expect(isDuplicate(2)).toBe(true);
  });

  it("calculates manual total value", () => {
    expect(itemTotal(3, 12.5)).toBe(37.5);
  });
});
