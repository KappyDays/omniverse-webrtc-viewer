import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAYOUTS,
  LAYOUT_STORAGE_KEY,
  loadStoredLayouts,
  saveStoredLayouts,
} from "./layoutConfig";

describe("layout config", () => {
  it("falls back to default layouts when localStorage is empty", () => {
    expect(loadStoredLayouts(null)).toEqual(DEFAULT_LAYOUTS);
  });

  it("loads persisted responsive layouts from localStorage", () => {
    const stored = {
      lg: [{ i: "viewport", x: 0, y: 0, w: 12, h: 18 }],
    };

    expect(loadStoredLayouts(JSON.stringify(stored))).toEqual({
      ...DEFAULT_LAYOUTS,
      lg: stored.lg,
    });
  });

  it("falls back to default layouts when localStorage contains invalid json", () => {
    expect(loadStoredLayouts("{")).toEqual(DEFAULT_LAYOUTS);
  });

  it("saves responsive layouts under the viewer layout key", () => {
    const storage = { setItem: vi.fn() };

    saveStoredLayouts(storage, DEFAULT_LAYOUTS);

    expect(storage.setItem).toHaveBeenCalledWith(
      LAYOUT_STORAGE_KEY,
      JSON.stringify(DEFAULT_LAYOUTS),
    );
  });
});
