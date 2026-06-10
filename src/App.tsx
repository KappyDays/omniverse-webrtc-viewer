import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { AppStreamer, StreamEvent } from "@nvidia/omniverse-webrtc-streaming-library";
import { ChevronDown, ChevronUp, GripVertical, Maximize2, MonitorPlay, Plug, Power, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import DirectStreamWindow from "./DirectStreamWindow";
import {
  DEFAULT_LAYOUTS,
  LAYOUT_STORAGE_KEY,
  loadStoredLayouts,
  saveStoredLayouts,
} from "./layoutConfig";
import {
  APP_PRESETS,
  applyAppPreset,
  DEFAULT_SETTINGS,
  parseResolution,
  type ConnectionSettings,
  RESOLUTION_OPTIONS,
  validateConnectionSettings,
} from "./viewerConfig";
type ConnectionState = "idle" | "connecting" | "connected" | "error";
type LayoutBreakpoint = "lg" | "md" | "sm";
type LayoutPanelId = "toolbar" | "viewport" | "status" | "log";
type LayoutEditMode = "move" | "resize";

const FPS_OPTIONS = [30, 60] as const;
const LAYOUT_BREAKPOINTS: Record<LayoutBreakpoint, number> = { lg: 1100, md: 760, sm: 0 };
const LAYOUT_COLS: Record<LayoutBreakpoint, number> = { lg: 12, md: 10, sm: 6 };
const LAYOUT_ROW_HEIGHT = 32;
const LAYOUT_MARGIN: [number, number] = [10, 10];
const LAYOUT_PADDING: [number, number] = [10, 10];
const ENABLE_LAYOUT_EDITOR = import.meta.env.VITE_ENABLE_LAYOUT_EDITOR === "true";
export const headerHeight = 60;

type LayoutMetrics = {
  breakpoint: LayoutBreakpoint;
  cols: number;
  colWidth: number;
  rowHeight: number;
  margin: [number, number];
  padding: [number, number];
};

type LayoutEditAction = {
  mode: LayoutEditMode;
  itemId: LayoutPanelId;
  breakpoint: LayoutBreakpoint;
  startX: number;
  startY: number;
  startItem: LayoutItem;
  metrics: LayoutMetrics;
};

type OverlayPosition = {
  x: number;
  y: number;
};

type OverlayDragAction = {
  startX: number;
  startY: number;
  startPosition: OverlayPosition;
};

function LayoutDragHandle({
  itemId,
  onPointerDown,
}: {
  itemId: LayoutPanelId;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, itemId: LayoutPanelId, mode: LayoutEditMode) => void;
}) {
  return (
    <button
      type="button"
      className="layout-drag-handle"
      title="Drag panel"
      aria-label={`Move ${itemId} panel`}
      onPointerDown={(event) => onPointerDown(event, itemId, "move")}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}

export default function App() {
  const [settings, setSettings] = useState<ConnectionSettings>(DEFAULT_SETTINGS);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isOverlayCollapsed, setIsOverlayCollapsed] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() =>
    loadStoredLayouts(window.localStorage.getItem(LAYOUT_STORAGE_KEY)),
  );
  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition>({ x: 12, y: 12 });
  const [viewerWidth, setViewerWidth] = useState(1280);
  const [streamKey, setStreamKey] = useState(0);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const layoutEditActionRef = useRef<LayoutEditAction | null>(null);
  const overlayDragActionRef = useRef<OverlayDragAction | null>(null);

  const isBusy = connectionState === "connecting";
  const isConnected = connectionState === "connected";
  const isStreamActive = isBusy || isConnected;

  const selectedResolutionLabel = useMemo(() => {
    return RESOLUTION_OPTIONS.find((option) => option.value === settings.resolution)?.label;
  }, [settings.resolution]);

  const selectedPreset = APP_PRESETS[settings.appPresetId];
  const targetLabel = `${settings.server.trim() || "unconfigured"}:${settings.signalingPort}`;
  const layoutBreakpoint = getLayoutBreakpoint(viewerWidth);
  const layoutMetrics = useMemo(() => getLayoutMetrics(viewerWidth, layoutBreakpoint), [viewerWidth, layoutBreakpoint]);
  const activeLayout = layouts[layoutBreakpoint] ?? DEFAULT_LAYOUTS[layoutBreakpoint] ?? [];
  const layoutById = useMemo(() => {
    return new Map(activeLayout.map((item) => [item.i as LayoutPanelId, item]));
  }, [activeLayout]);
  const layoutHeight = getLayoutHeight(activeLayout, layoutMetrics);

  useEffect(() => {
    return () => {
      clearConnectionTimeout();
      void stopStream();
    };
  }, []);

  useEffect(() => {
    const element = viewerRef.current;
    if (!isStreamActive || !element) {
      return;
    }

    const updateWidth = () => {
      setViewerWidth(Math.max(320, Math.floor(element.getBoundingClientRect().width)));
    };
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isStreamActive]);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      const overlayAction = overlayDragActionRef.current;
      if (overlayAction) {
        event.preventDefault();
        setOverlayPosition({
          x: Math.max(0, overlayAction.startPosition.x + event.clientX - overlayAction.startX),
          y: Math.max(0, overlayAction.startPosition.y + event.clientY - overlayAction.startY),
        });
        return;
      }

      const action = layoutEditActionRef.current;
      if (!action) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - action.startX;
      const deltaY = event.clientY - action.startY;
      const columnStep = action.metrics.colWidth + action.metrics.margin[0];
      const rowStep = action.metrics.rowHeight + action.metrics.margin[1];
      const gridDeltaX = Math.round(deltaX / columnStep);
      const gridDeltaY = Math.round(deltaY / rowStep);

      setLayouts((currentLayouts) => updateLayoutItem(currentLayouts, action, gridDeltaX, gridDeltaY));
    }

    function handlePointerUp() {
      layoutEditActionRef.current = null;
      overlayDragActionRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  function updateSettings<K extends keyof ConnectionSettings>(
    key: K,
    value: ConnectionSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updatePreset(appPresetId: ConnectionSettings["appPresetId"]) {
    setSettings((current) => applyAppPreset(current, appPresetId));
  }

  async function connect() {
    clearConnectionTimeout();
    const validation = validateConnectionSettings(settings);
    if (!validation.ok) {
      setConnectionState("error");
      setStatusText(validation.message);
      return;
    }

    setConnectionState("connecting");
    setStatusText(`Connecting to ${selectedPreset.label} at ${settings.server}:${settings.signalingPort}`);
    setEventLog([
      `connect: ${selectedPreset.label}`,
      `target: ${settings.server}:${settings.signalingPort}`,
      `media: ${settings.mediaPort.trim() || "auto"}`,
    ]);
    setStreamKey((current) => current + 1);
  }

  async function disconnect() {
    clearConnectionTimeout();
    setStatusText("Disconnecting");
    await stopStream();
    setConnectionState("idle");
    setStatusText("Ready");
  }

  function saveLayout() {
    saveStoredLayouts(window.localStorage, layouts);
    appendLog("layout: saved");
    setIsEditingLayout(false);
  }

  function resetLayout() {
    setLayouts(DEFAULT_LAYOUTS);
    saveStoredLayouts(window.localStorage, DEFAULT_LAYOUTS);
    appendLog("layout: reset");
    setIsEditingLayout(false);
  }

  function beginLayoutEdit(
    event: PointerEvent<HTMLButtonElement>,
    itemId: LayoutPanelId,
    mode: LayoutEditMode,
  ) {
    if (!isEditingLayout) {
      return;
    }

    const item = layoutById.get(itemId);
    if (!item) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    layoutEditActionRef.current = {
      mode,
      itemId,
      breakpoint: layoutBreakpoint,
      startX: event.clientX,
      startY: event.clientY,
      startItem: item,
      metrics: layoutMetrics,
    };
  }

  function beginOverlayDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    overlayDragActionRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPosition: overlayPosition,
    };
  }

  function renderLayoutItem(itemId: LayoutPanelId, content: ReactNode) {
    const item = layoutById.get(itemId);
    if (!item) {
      return null;
    }

    return (
      <div
        key={itemId}
        className="layout-item"
        data-layout-id={itemId}
        style={getLayoutItemStyle(item, layoutMetrics)}
      >
        {content}
        {isEditingLayout ? (
          <button
            type="button"
            className="layout-resize-handle"
            title="Resize panel"
            aria-label={`Resize ${itemId} panel`}
            onPointerDown={(event) => beginLayoutEdit(event, itemId, "resize")}
          />
        ) : null}
      </div>
    );
  }

  function renderStreamWindow() {
    return (
      <DirectStreamWindow
        key={streamKey}
        sessionId=""
        backendUrl=""
        signalingserver={settings.server.trim()}
        signalingport={settings.signalingPort}
        mediaserver={settings.server.trim()}
        mediaport={mediaPort}
        accessToken=""
        resolutionWidth={resolutionWidth}
        resolutionHeight={resolutionHeight}
        onStarted={() => handleStreamStart({ action: "start", status: "success" } as StreamEvent)}
        onStreamFailed={() => {
          clearConnectionTimeout();
          setConnectionState("error");
          setStatusText("Stream connection failed.");
        }}
        onLoggedIn={(userId) => appendLog(`logged in: ${userId}`)}
        handleCustomEvent={handleCustomEvent}
      />
    );
  }

  function renderStreamActions(includeLayoutControls: boolean) {
    return (
      <div className="stream-actions">
        {includeLayoutControls ? (
          <>
            <button
              type="button"
              onClick={() => setIsEditingLayout((current) => !current)}
              title="Edit Layout"
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={saveLayout} title="Save Layout">
              <Save size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={resetLayout} title="Reset Layout">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          </>
        ) : null}
        <button type="button" onClick={toggleFullscreen} title="Fullscreen">
          <Maximize2 size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={disconnect} title="Disconnect">
          <Power size={18} aria-hidden="true" />
        </button>
      </div>
    );
  }

  function renderFullFitViewer() {
    return (
      <section
        className="viewer-screen viewer-screen-fit"
        ref={viewerRef}
        aria-label="Omniverse Kit stream"
      >
        <div className="viewer-fit-shell" aria-label="Fullscreen stream viewer" onMouseDown={focusVideo}>
          {renderStreamWindow()}
        </div>
        <div
          className={`viewer-overlay ${isOverlayCollapsed ? "collapsed" : ""}`}
          style={{ left: overlayPosition.x, top: overlayPosition.y }}
        >
          {isOverlayCollapsed ? (
            <button
              type="button"
              onClick={() => setIsOverlayCollapsed(false)}
              title="Expand viewer controls"
              aria-label="Expand viewer controls"
            >
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="viewer-overlay-drag"
                aria-label="Move viewer controls"
                title="Move viewer controls"
                onPointerDown={beginOverlayDrag}
              >
                <GripVertical size={15} aria-hidden="true" />
              </button>
              <div className="stream-title">
                <MonitorPlay size={18} aria-hidden="true" />
                <span>{selectedPreset.label}</span>
                <span title={targetLabel}>{selectedResolutionLabel}</span>
                <span>{settings.fps} FPS</span>
                <strong>{statusText}</strong>
              </div>
              {renderStreamActions(false)}
              <button
                type="button"
                onClick={() => setIsOverlayCollapsed(true)}
                title="Collapse viewer controls"
                aria-label="Collapse viewer controls"
              >
                <ChevronUp size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  function renderLayoutEditorViewer() {
    return (
      <section className="viewer-screen" ref={viewerRef} aria-label="Omniverse Kit stream">
        <div
          className={`viewer-layout ${isEditingLayout ? "editing" : ""}`}
          style={{ height: layoutHeight }}
        >
          {renderLayoutItem(
            "toolbar",
            <header className="stream-toolbar layout-panel">
              {isEditingLayout ? <LayoutDragHandle itemId="toolbar" onPointerDown={beginLayoutEdit} /> : null}
              <div className="stream-title">
                <MonitorPlay size={18} aria-hidden="true" />
                <span>{selectedPreset.label}</span>
                <span>{targetLabel}</span>
                <strong>{statusText}</strong>
              </div>
              {renderStreamActions(true)}
            </header>,
          )}
          {renderLayoutItem(
            "viewport",
            <div className="video-frame layout-panel" onMouseDown={focusVideo}>
              {renderStreamWindow()}
              {isEditingLayout ? <LayoutDragHandle itemId="viewport" onPointerDown={beginLayoutEdit} /> : null}
            </div>,
          )}
          {renderLayoutItem(
            "status",
            <aside className="status-panel layout-panel">
              {isEditingLayout ? <LayoutDragHandle itemId="status" onPointerDown={beginLayoutEdit} /> : null}
              <span>Target</span>
              <strong>{targetLabel}</strong>
              <span>Status</span>
              <strong className={connectionState}>{statusText}</strong>
              <span>Resolution</span>
              <strong>{selectedResolutionLabel}</strong>
              <span>FPS</span>
              <strong>{settings.fps}</strong>
            </aside>,
          )}
          {renderLayoutItem(
            "log",
            <aside className="log-panel layout-panel">
              {isEditingLayout ? <LayoutDragHandle itemId="log" onPointerDown={beginLayoutEdit} /> : null}
              <div>
                <strong>Event Log</strong>
                <span>{isEditingLayout ? "Drag panels to arrange the web UI." : "Runtime stream events"}</span>
              </div>
              <pre aria-label="Connection events">
                {eventLog.length > 0 ? eventLog.join("\n") : "No events yet."}
              </pre>
            </aside>,
          )}
        </div>
      </section>
    );
  }

  async function stopStream() {
    try {
      await AppStreamer.terminate(false);
    } catch {
      try {
        await AppStreamer.stop();
      } catch {
        // The NVIDIA library throws when no controller exists. Disconnect is idempotent here.
      }
    } finally {
      (AppStreamer as unknown as { _stream?: unknown })._stream = null;
    }
  }

  function clearConnectionTimeout() {
    if (timeoutRef.current === null) {
      return;
    }
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  async function toggleFullscreen() {
    const element = viewerRef.current;
    if (!element) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  }

  function handleStreamStart(message: StreamEvent) {
    appendLog(formatStreamEvent("start", message));
    if (message.status === "success") {
      clearConnectionTimeout();
      setConnectionState("connected");
      setStatusText("Connected");
      focusVideo();
      return;
    }

    if (message.status === "error") {
      clearConnectionTimeout();
      setConnectionState("error");
      setStatusText(message.info ? String(message.info) : "Stream connection failed.");
    }
  }

  function handleCustomEvent(message: unknown) {
    appendLog(`custom: ${safeStringify(message)}`);
    console.debug("Kit custom event", message);
  }

  function focusVideo() {
    window.setTimeout(() => {
      document.getElementById("remote-video")?.focus({ preventScroll: true });
    }, 50);
  }

  function appendLog(message: string) {
    setEventLog((current) => [...current.slice(-7), message]);
  }

  const mediaPort = Number(settings.mediaPort.trim()) || 0;
  const { width: resolutionWidth, height: resolutionHeight } = useMemo(
    () => parseResolution(settings.resolution),
    [settings.resolution],
  );

  return (
    <main className="app-shell">
      {!isStreamActive ? (
        <section className="connect-screen" aria-label="Connection settings">
          <h1>Omniverse WebRTC Viewer</h1>

          <div className="settings-form">
            <div className="target-card" aria-label="Streaming target">
              <span>Target</span>
              <strong>{targetLabel}</strong>
            </div>

            <label className="field-row" htmlFor="app-preset">
              <span>App:</span>
              <select
                id="app-preset"
                value={settings.appPresetId}
                onChange={(event) =>
                  updatePreset(event.target.value as ConnectionSettings["appPresetId"])
                }
              >
                {Object.entries(APP_PRESETS).map(([id, preset]) => (
                  <option key={id} value={id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-row" htmlFor="resolution">
              <span>Resolution:</span>
              <select
                id="resolution"
                value={settings.resolution}
                onChange={(event) =>
                  updateSettings("resolution", event.target.value as ConnectionSettings["resolution"])
                }
                aria-label={`Resolution ${selectedResolutionLabel}`}
              >
                {RESOLUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-row" htmlFor="fps">
              <span>FPS:</span>
              <select
                id="fps"
                value={settings.fps}
                onChange={(event) => updateSettings("fps", Number(event.target.value))}
                aria-label={`FPS ${settings.fps}`}
              >
                {FPS_OPTIONS.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="advanced-toggle"
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>{showAdvanced ? "Hide Advanced" : "Advanced"}</span>
            </button>

            {showAdvanced ? (
              <div className="advanced-grid">
                <label htmlFor="server-override">
                  <span>Server Override</span>
                  <input
                    id="server-override"
                    value={settings.server}
                    onChange={(event) => updateSettings("server", event.target.value)}
                    placeholder="kit-host.local"
                    autoComplete="off"
                  />
                </label>
                <label htmlFor="signaling-port">
                  <span>Signaling Port</span>
                  <input
                    id="signaling-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.signalingPort}
                    onChange={(event) =>
                      updateSettings("signalingPort", Number(event.target.value))
                    }
                  />
                </label>
                <label htmlFor="media-port">
                  <span>Media Port</span>
                  <input
                    id="media-port"
                    inputMode="numeric"
                    placeholder="auto"
                    value={settings.mediaPort}
                    onChange={(event) => updateSettings("mediaPort", event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <button
              className="connect-button"
              type="button"
              onClick={connect}
              disabled={isBusy}
            >
              <Plug size={22} aria-hidden="true" />
              <span>{isBusy ? "Connecting" : "Connect"}</span>
            </button>

            <p className={`status-line ${connectionState}`}>{statusText}</p>
            <p className="preset-note">{selectedPreset.description}</p>
            {eventLog.length > 0 ? (
              <pre className="event-log" aria-label="Connection events">
                {eventLog.join("\n")}
              </pre>
            ) : null}
          </div>
        </section>
      ) : ENABLE_LAYOUT_EDITOR ? renderLayoutEditorViewer() : renderFullFitViewer()}
    </main>
  );
}

function formatStreamEvent(label: string, event: StreamEvent) {
  return `${label}: ${event.action}/${event.status}${event.info ? ` - ${String(event.info)}` : ""}`;
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getLayoutBreakpoint(width: number): LayoutBreakpoint {
  if (width >= LAYOUT_BREAKPOINTS.lg) {
    return "lg";
  }

  if (width >= LAYOUT_BREAKPOINTS.md) {
    return "md";
  }

  return "sm";
}

function getLayoutMetrics(width: number, breakpoint: LayoutBreakpoint): LayoutMetrics {
  const cols = LAYOUT_COLS[breakpoint];
  const [marginX] = LAYOUT_MARGIN;
  const [paddingX, paddingY] = LAYOUT_PADDING;
  const usableWidth = Math.max(1, width - paddingX * 2 - marginX * (cols - 1));

  return {
    breakpoint,
    cols,
    colWidth: usableWidth / cols,
    rowHeight: LAYOUT_ROW_HEIGHT,
    margin: LAYOUT_MARGIN,
    padding: [paddingX, paddingY],
  };
}

function getLayoutItemStyle(item: LayoutItem, metrics: LayoutMetrics): CSSProperties {
  const [marginX, marginY] = metrics.margin;
  const [paddingX, paddingY] = metrics.padding;
  const left = paddingX + item.x * (metrics.colWidth + marginX);
  const top = paddingY + item.y * (metrics.rowHeight + marginY);
  const width = item.w * metrics.colWidth + Math.max(0, item.w - 1) * marginX;
  const height = item.h * metrics.rowHeight + Math.max(0, item.h - 1) * marginY;

  return {
    height,
    left,
    top,
    width,
  };
}

function getLayoutHeight(layout: readonly LayoutItem[], metrics: LayoutMetrics) {
  const [, marginY] = metrics.margin;
  const [, paddingY] = metrics.padding;
  const bottom = layout.reduce((max, item) => {
    return Math.max(max, item.y + item.h);
  }, 0);

  return paddingY * 2 + bottom * metrics.rowHeight + Math.max(0, bottom - 1) * marginY;
}

function updateLayoutItem(
  layouts: ResponsiveLayouts,
  action: LayoutEditAction,
  gridDeltaX: number,
  gridDeltaY: number,
): ResponsiveLayouts {
  const layout = layouts[action.breakpoint] ?? DEFAULT_LAYOUTS[action.breakpoint] ?? [];
  const nextLayout = layout.map((item) => {
    if (item.i !== action.itemId) {
      return item;
    }

    if (action.mode === "resize") {
      const minW = item.minW ?? 1;
      const minH = item.minH ?? 1;
      return {
        ...item,
        w: clamp(action.startItem.w + gridDeltaX, minW, action.metrics.cols - action.startItem.x),
        h: Math.max(minH, action.startItem.h + gridDeltaY),
      };
    }

    return {
      ...item,
      x: clamp(action.startItem.x + gridDeltaX, 0, action.metrics.cols - action.startItem.w),
      y: Math.max(0, action.startItem.y + gridDeltaY),
    };
  });

  return {
    ...layouts,
    [action.breakpoint]: nextLayout,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
