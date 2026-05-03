import { describe, expect, it } from "vitest";
import { priceService } from "./price.service.js";

describe("priceService", () => {
  it("always returns a complete price object for new collections", async () => {
    const price = await priceService.getCardPrice({
      cardName: "Pikachu",
      collectionName: "Colecao Nova Teste",
      setCode: "TST",
      cardNumber: "025",
      variantType: "NORMAL",
      cardClass: "COMMON"
    });

    expect(price.estimatedPrice).toBeGreaterThan(0);
    expect(price.minPrice).toBeGreaterThanOrEqual(0);
    expect(price.maxPrice).toBeGreaterThan(price.minPrice);
    expect(price.source).toBeTruthy();
    expect(price.confidence).toBeTruthy();
    expect(price.status).toBe("PRICE_PENDING");
  });

  it("does not mix variants when pricing the same card", async () => {
    const normal = await priceService.getCardPrice({
      cardName: "Charizard",
      collectionName: "Teste",
      cardNumber: "004",
      variantType: "NORMAL",
      cardClass: "RARE"
    });
    const alternate = await priceService.getCardPrice({
      cardName: "Charizard",
      collectionName: "Teste",
      cardNumber: "004",
      variantType: "ALTERNATE_ART",
      cardClass: "RARE"
    });

    expect(alternate.estimatedPrice).toBeGreaterThan(normal.estimatedPrice);
    expect(normal.variantType).toBe("NORMAL");
    expect(alternate.variantType).toBe("ALTERNATE_ART");
  });
});
