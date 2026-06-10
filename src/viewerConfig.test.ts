import { describe, expect, it } from "vitest";
import {
  APP_PRESETS,
  applyAppPreset,
  buildDirectStreamConfig,
  DEFAULT_SETTINGS,
  parseResolution,
  RESOLUTION_OPTIONS,
  validateConnectionSettings,
} from "./viewerConfig";
import StreamConfig from "./streamConfig";

describe("viewer config", () => {
  it("parses width and height from a resolution option", () => {
    expect(parseResolution("1920x1080")).toEqual({ width: 1920, height: 1080 });
  });

  it("offers only FHD, QHD, and UHD stream resolution choices", () => {
    expect(RESOLUTION_OPTIONS.map((option) => option.value)).toEqual([
      "1920x1080",
      "2560x1440",
      "3840x2160",
    ]);
  });

  it("uses stream.config.json local settings as the initial target", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      server: StreamConfig.local.server,
      signalingPort: StreamConfig.local.signalingPort,
      mediaPort: StreamConfig.local.mediaPort == null ? "" : String(StreamConfig.local.mediaPort),
    });
  });

  it("rejects an empty server value", () => {
    expect(validateConnectionSettings({
      server: " ",
      appPresetId: "custom-kit",
      signalingPort: 49100,
      mediaPort: "",
      resolution: "1920x1080",
      fps: 60,
    })).toEqual({ ok: false, message: "Server is required." });
  });

  it("applies the USD Composer preset without changing the target host", () => {
    expect(applyAppPreset({
      server: "kit-host.local",
      appPresetId: "isaac-sim",
      signalingPort: 49100,
      mediaPort: "",
      resolution: "1920x1080",
      fps: 60,
    }, "usd-composer")).toMatchObject({
      server: "kit-host.local",
      appPresetId: "usd-composer",
      signalingPort: APP_PRESETS["usd-composer"].signalingPort,
      resolution: APP_PRESETS["usd-composer"].resolution,
    });
  });

  it("builds a direct stream config for any remote Kit app host", () => {
    const config = buildDirectStreamConfig({
      server: "kit-host.local",
      appPresetId: "custom-kit",
      signalingPort: 49100,
      mediaPort: "47998",
      resolution: "1920x1080",
      fps: 60,
    });

    expect(config).toMatchObject({
      signalingServer: "kit-host.local",
      signalingPort: 49100,
      mediaServer: "kit-host.local",
      mediaPort: 47998,
      width: 1920,
      height: 1080,
      fps: 60,
      authenticate: true,
    });
    expect(config).not.toHaveProperty("server");
    expect(config).not.toHaveProperty("autoLaunch");
    expect(config).not.toHaveProperty("cursor");
    expect(config).not.toHaveProperty("mic");
  });
});
