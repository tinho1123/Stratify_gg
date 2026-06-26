import { fmtCountdown, fmtPrice } from "../utils/market";

// ── fmtPrice ─────────────────────────────────────────────────────────────────

describe("fmtPrice", () => {
  it("values under $1K → plain dollar", () => {
    expect(fmtPrice(0)).toBe("$0");
    expect(fmtPrice(500)).toBe("$500");
    expect(fmtPrice(999)).toBe("$999");
  });

  it("values ≥ $1K and < $1M → K format (rounded)", () => {
    expect(fmtPrice(1000)).toBe("$1K");
    expect(fmtPrice(1500)).toBe("$2K");
    expect(fmtPrice(50_000)).toBe("$50K");
    expect(fmtPrice(999_999)).toBe("$1000K");
  });

  it("values ≥ $1M → M format (1 decimal)", () => {
    expect(fmtPrice(1_000_000)).toBe("$1.0M");
    expect(fmtPrice(1_500_000)).toBe("$1.5M");
    expect(fmtPrice(10_000_000)).toBe("$10.0M");
  });
});

// ── fmtCountdown ─────────────────────────────────────────────────────────────

describe("fmtCountdown", () => {
  const future = (ms: number) => new Date(Date.now() + ms).toISOString();
  const past   = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("past date → ENCERRADO (urgent)", () => {
    const result = fmtCountdown(past(1000));
    expect(result.text).toBe("ENCERRADO");
    expect(result.urgent).toBe(true);
  });

  it("< 1 minute → seconds only, urgent", () => {
    const result = fmtCountdown(future(30_000)); // 30s
    expect(result.text).toMatch(/^\d+s$/);
    expect(result.urgent).toBe(true);
  });

  it("1–59 minutes → Xm Ys format, urgent", () => {
    const result = fmtCountdown(future(5 * 60_000 + 10_000)); // 5m10s
    expect(result.text).toMatch(/^\d+m \d+s$/);
    expect(result.urgent).toBe(true);
  });

  it("< 2 hours → urgent", () => {
    const result = fmtCountdown(future(1 * 3_600_000 + 30 * 60_000)); // 1h30m
    expect(result.urgent).toBe(true);
    expect(result.text).toMatch(/^1h \d+m$/);
  });

  it("≥ 2 hours → not urgent", () => {
    const result = fmtCountdown(future(3 * 3_600_000)); // 3h
    expect(result.urgent).toBe(false);
    expect(result.text).toMatch(/^3h \d+m$/);
  });

  it("exact 2h → not urgent", () => {
    const result = fmtCountdown(future(2 * 3_600_000 + 1000));
    expect(result.urgent).toBe(false);
  });

  it("large countdown → hours format", () => {
    const result = fmtCountdown(future(24 * 3_600_000)); // 24h
    expect(result.text).toMatch(/^\d+h \d+m$/);
    expect(result.urgent).toBe(false);
  });
});
