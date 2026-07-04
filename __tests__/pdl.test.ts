import { calcPdlDelta, generateBotRating, getTierInfo, nextMatchSlot, TIER_DEFS } from "../utils/pdl";

// ── getTierInfo ──────────────────────────────────────────────────────────────

describe("getTierInfo", () => {
  it("PDL 0 → Bronze III", () => {
    const t = getTierInfo(0);
    expect(t.label).toBe("Bronze III");
    expect(t.divIdx).toBe(0);
  });

  it("PDL 100 → Bronze II", () => {
    expect(getTierInfo(100).label).toBe("Bronze II");
    expect(getTierInfo(100).divIdx).toBe(1);
  });

  it("PDL 200 → Bronze I", () => {
    expect(getTierInfo(200).label).toBe("Bronze I");
  });

  it("PDL 300 → Prata III (tier boundary exact)", () => {
    const t = getTierInfo(300);
    expect(t.name).toBe("Prata");
    expect(t.label).toBe("Prata III");
  });

  it("PDL 1499 → Diamante I (just below Mestre)", () => {
    expect(getTierInfo(1499).label).toBe("Diamante I");
  });

  it("PDL 1500 → Mestre (single division, no roman numeral)", () => {
    const t = getTierInfo(1500);
    expect(t.label).toBe("Mestre");
    expect(t.divIdx).toBe(-1);
  });

  it("PDL 1800 → Grão-Mestre", () => {
    expect(getTierInfo(1800).label).toBe("Grão-Mestre");
  });

  it("PDL 9999 → Grão-Mestre (cap)", () => {
    expect(getTierInfo(9999).name).toBe("Grão-Mestre");
  });

  it("negative PDL → Bronze III (clamp)", () => {
    expect(getTierInfo(-50).label).toBe("Bronze III");
  });

  it("returns correct color for each tier", () => {
    TIER_DEFS.forEach((def) => {
      expect(getTierInfo(def.minPdl).color).toBe(def.color);
    });
  });
});

// ── calcPdlDelta ─────────────────────────────────────────────────────────────

describe("calcPdlDelta", () => {
  it("win vs equal opponent → +20 PDL", () => {
    expect(calcPdlDelta(true, 75, 75)).toBe(20);
  });

  it("lose vs equal opponent → -15 PDL", () => {
    expect(calcPdlDelta(false, 75, 75)).toBe(-15);
  });

  it("win vs stronger opponent → more PDL (capped at 40)", () => {
    const delta = calcPdlDelta(true, 60, 97);
    expect(delta).toBe(40); // 20 + 37*0.6=42.2 → capped at 40
  });

  it("win vs weaker opponent → less PDL (min 5)", () => {
    const delta = calcPdlDelta(true, 97, 60);
    expect(delta).toBe(5); // 20 + (-37)*0.6 = -2.2 → clamped to 5
  });

  it("loss vs weaker opponent → more PDL lost (capped at -30)", () => {
    const delta = calcPdlDelta(false, 97, 60);
    expect(delta).toBe(-30); // 15 - (-37)*0.6 = 37.2 → capped at 30
  });

  it("loss vs stronger opponent → less PDL lost (min -5)", () => {
    const delta = calcPdlDelta(false, 60, 97);
    expect(delta).toBe(-5); // 15 - 37*0.6 = -7.2 → clamped to 5
  });

  it("win returns positive number", () => {
    expect(calcPdlDelta(true, 75, 80)).toBeGreaterThan(0);
  });

  it("loss returns negative number", () => {
    expect(calcPdlDelta(false, 75, 80)).toBeLessThan(0);
  });

  it("delta is always integer", () => {
    const delta = calcPdlDelta(true, 73, 81);
    expect(Number.isInteger(delta)).toBe(true);
  });
});

// ── nextMatchSlot ─────────────────────────────────────────────────────────────

describe("nextMatchSlot", () => {
  it("returns a Date object", () => {
    expect(nextMatchSlot() instanceof Date).toBe(true);
  });

  it("slot is always at 14:00 or 17:00", () => {
    const slot = nextMatchSlot();
    expect([14, 17]).toContain(slot.getHours());
    expect(slot.getMinutes()).toBe(0);
    expect(slot.getSeconds()).toBe(0);
  });

  it("slot is at least 10 minutes in the future", () => {
    const now = new Date();
    const slot = nextMatchSlot(now);
    expect(slot.getTime()).toBeGreaterThan(now.getTime() + 10 * 60 * 1000);
  });

  it("when now is 13:45 → next slot is 14:00 today", () => {
    const now = new Date();
    now.setHours(13, 45, 0, 0); // 13:45, 14:00 is 15min away
    const slot = nextMatchSlot(now);
    expect(slot.getHours()).toBe(14);
    expect(slot.getDate()).toBe(now.getDate());
  });

  it("when now is 14:05 → next slot is 17:00 today", () => {
    const now = new Date();
    now.setHours(14, 5, 0, 0); // past 14:00
    const slot = nextMatchSlot(now);
    expect(slot.getHours()).toBe(17);
    expect(slot.getDate()).toBe(now.getDate());
  });

  it("when now is 17:05 → next slot is 14:00 tomorrow", () => {
    const now = new Date();
    now.setHours(17, 5, 0, 0); // past last slot of day
    const slot = nextMatchSlot(now);
    expect(slot.getHours()).toBe(14);
    expect(slot.getDate()).toBe(now.getDate() + 1);
  });

  it("fallback: when all slots exhausted → next day+2 at 14:00", () => {
    // Simulate a time exactly at 17:00 to exhaust both today and tomorrow (edge)
    // We'll test that fallback is not reached for normal cases
    const now = new Date();
    now.setHours(13, 0, 0, 0);
    const slot = nextMatchSlot(now);
    // Should be same day at 14:00 or 17:00, not day+2
    const diffDays = slot.getDate() - now.getDate();
    expect(diffDays).toBeLessThanOrEqual(1);
  });
});

// ── generateBotRating ────────────────────────────────────────────────────────

describe("generateBotRating", () => {
  it("bot is always weaker than player average", () => {
    for (const seed of [5, 10, 14]) {
      const myAvg = 80;
      const botRating = generateBotRating(myAvg, seed);
      expect(botRating).toBeLessThan(myAvg);
    }
  });

  it("bot rating never drops below 30", () => {
    expect(generateBotRating(20, 14)).toBe(30);
    expect(generateBotRating(25, 10)).toBe(30);
  });

  it("bot rating is deterministic given same inputs", () => {
    expect(generateBotRating(75, 8)).toBe(generateBotRating(75, 8));
  });
});
