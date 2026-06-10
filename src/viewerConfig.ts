import StreamConfig from "./streamConfig";

export const RESOLUTION_OPTIONS = [
  { label: "1920 x 1080 (FHD)", value: "1920x1080" },
  { label: "2560 x 1440 (QHD)", value: "2560x1440" },
  { label: "3840 x 2160 (UHD)", value: "3840x2160" },
] as const;

export type ResolutionValue = (typeof RESOLUTION_OPTIONS)[number]["value"];

export const APP_PRESETS = {
  "custom-kit": {
    label: "Custom Kit App",
    description: "Any Omniverse Kit app with WebRTC livestreaming enabled.",
    signalingPort: 49100,
    mediaPort: "",
    resolution: "1920x1080" as ResolutionValue,
    fps: 60,
  },
  "isaac-sim": {
    label: "Isaac Sim",
    description: "Isaac Sim Full Streaming or an Isaac-based Kit app.",
    signalingPort: 49100,
    mediaPort: "",
    resolution: "1920x1080" as ResolutionValue,
    fps: 60,
  },
  "usd-composer": {
    label: "USD Composer",
    description: "USD Composer or a Composer-derived Kit app.",
    signalingPort: 49100,
    mediaPort: "",
    resolution: "1920x1080" as ResolutionValue,
    fps: 60,
  },
} as const;

export type AppPresetId = keyof typeof APP_PRESETS;

export type ConnectionSettings = {
  server: string;
  appPresetId: AppPresetId;
  signalingPort: number;
  mediaPort: string;
  resolution: ResolutionValue;
  fps: number;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type DirectStreamConfig = {
  videoElementId: string;
  audioElementId: string;
  authenticate: boolean;
  maxReconnects: number;
  signalingServer: string;
  signalingPort: number;
  mediaServer: string;
  mediaPort?: number;
  nativeTouchEvents: boolean;
  width: number;
  height: number;
  fps: number;
};

export const DEFAULT_SETTINGS: ConnectionSettings = {
  server: StreamConfig.local.server,
  appPresetId: "custom-kit",
  signalingPort: StreamConfig.local.signalingPort,
  mediaPort: StreamConfig.local.mediaPort == null ? "" : String(StreamConfig.local.mediaPort),
  resolution: toResolutionValue(
    StreamConfig.resolution.defaultWidth,
    StreamConfig.resolution.defaultHeight,
    APP_PRESETS["custom-kit"].resolution,
  ),
  fps: APP_PRESETS["custom-kit"].fps,
};

function toResolutionValue(width: number, height: number, fallback: ResolutionValue): ResolutionValue {
  const value = `${width}x${height}` as ResolutionValue;
  return RESOLUTION_OPTIONS.some((option) => option.value === value) ? value : fallback;
}

export function parseResolution(value: ResolutionValue) {
  const [width, height] = value.split("x").map((item) => Number(item));
  return { width, height };
}

export function validateConnectionSettings(
  settings: ConnectionSettings,
): ValidationResult {
  if (settings.server.trim().length === 0) {
    return { ok: false, message: "Server is required." };
  }

  if (!Number.isInteger(settings.signalingPort) || settings.signalingPort <= 0) {
    return { ok: false, message: "Signaling port must be a positive integer." };
  }

  if (settings.mediaPort.trim().length > 0) {
    const mediaPort = Number(settings.mediaPort);
    if (!Number.isInteger(mediaPort) || mediaPort <= 0) {
      return { ok: false, message: "Media port must be a positive integer." };
    }
  }

  return { ok: true };
}

export function applyAppPreset(
  currentSettings: ConnectionSettings,
  appPresetId: AppPresetId,
): ConnectionSettings {
  const preset = APP_PRESETS[appPresetId];
  return {
    ...currentSettings,
    appPresetId,
    signalingPort: preset.signalingPort,
    mediaPort: preset.mediaPort,
    resolution: preset.resolution,
    fps: preset.fps,
  };
}

export function buildDirectStreamConfig(
  settings: ConnectionSettings,
): DirectStreamConfig {
  const { width, height } = parseResolution(settings.resolution);
  const trimmedMediaPort = settings.mediaPort.trim();
  const server = settings.server.trim();
  const config: DirectStreamConfig = {
    videoElementId: "remote-video",
    audioElementId: "remote-audio",
    authenticate: true,
    maxReconnects: 20,
    signalingServer: server,
    signalingPort: settings.signalingPort,
    mediaServer: server,
    nativeTouchEvents: true,
    width,
    height,
    fps: settings.fps,
  };

  if (trimmedMediaPort.length > 0) {
    config.mediaPort = Number(trimmedMediaPort);
  }

  return config;
}
