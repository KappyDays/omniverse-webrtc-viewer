import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout";

export type ViewerLayouts = ResponsiveLayouts;

export const LAYOUT_STORAGE_KEY = "omniverse-webrtc-viewer.layout.v1";

export const DEFAULT_LAYOUTS: ViewerLayouts = {
  lg: [
    { i: "toolbar", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
    { i: "viewport", x: 0, y: 2, w: 9, h: 20, minW: 5, minH: 10 },
    { i: "status", x: 9, y: 2, w: 3, h: 6, minW: 3, minH: 4 },
    { i: "log", x: 9, y: 8, w: 3, h: 14, minW: 3, minH: 6 },
  ],
  md: [
    { i: "toolbar", x: 0, y: 0, w: 10, h: 2, minW: 5, minH: 2 },
    { i: "viewport", x: 0, y: 2, w: 7, h: 18, minW: 5, minH: 10 },
    { i: "status", x: 7, y: 2, w: 3, h: 6, minW: 3, minH: 4 },
    { i: "log", x: 7, y: 8, w: 3, h: 12, minW: 3, minH: 6 },
  ],
  sm: [
    { i: "toolbar", x: 0, y: 0, w: 6, h: 3, minW: 4, minH: 2 },
    { i: "viewport", x: 0, y: 3, w: 6, h: 14, minW: 4, minH: 10 },
    { i: "status", x: 0, y: 17, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "log", x: 0, y: 22, w: 6, h: 8, minW: 4, minH: 6 },
  ],
};

const layoutKeys = new Set(["toolbar", "viewport", "status", "log"]);

export function loadStoredLayouts(rawValue: string | null): ViewerLayouts {
  if (!rawValue) {
    return DEFAULT_LAYOUTS;
  }

  try {
    const parsed = JSON.parse(rawValue) as ViewerLayouts;
    return mergeValidLayouts(parsed);
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

export function saveStoredLayouts(
  storage: Pick<Storage, "setItem">,
  layouts: ViewerLayouts,
) {
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
}

function mergeValidLayouts(candidate: ViewerLayouts): ViewerLayouts {
  return Object.entries(DEFAULT_LAYOUTS).reduce<ViewerLayouts>((merged, [breakpoint, defaultLayout]) => {
    const candidateLayout = candidate[breakpoint];
    merged[breakpoint] = isValidLayout(candidateLayout) ? candidateLayout : defaultLayout;
    return merged;
  }, {});
}

function isValidLayout(value: unknown): value is Layout {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => {
      const layout = item as Partial<LayoutItem>;
      return typeof layout.i === "string"
        && layoutKeys.has(layout.i)
        && Number.isFinite(layout.x)
        && Number.isFinite(layout.y)
        && Number.isFinite(layout.w)
        && Number.isFinite(layout.h);
    });
}
