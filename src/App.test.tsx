import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppStreamer } from "@nvidia/omniverse-webrtc-streaming-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

let remoteVideoAtConnect: HTMLElement | null = null;
let mainDivAtConnect: HTMLElement | null = null;

vi.mock("@nvidia/omniverse-webrtc-streaming-library", () => ({
  AppStreamer: {
    connect: vi.fn(() => {
      remoteVideoAtConnect = document.getElementById("remote-video");
      mainDivAtConnect = document.getElementById("main-div");
      return Promise.resolve({
        action: "start",
        status: "inProgress",
        info: "Starting stream.",
      });
    }),
    stop: vi.fn(() => Promise.resolve()),
    terminate: vi.fn(() => Promise.resolve()),
  },
  StreamType: {
    DIRECT: "direct",
  },
}));

describe("App streaming connection", () => {
  afterEach(() => {
    remoteVideoAtConnect = null;
    mainDivAtConnect = null;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the remote video element before starting the WebRTC connection", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(remoteVideoAtConnect).not.toBeNull();
    });
  });

  it("renders the NVIDIA stream container before starting the WebRTC connection", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(mainDivAtConnect).not.toBeNull();
    });
  });

  it("shows the resolved target while hiding the server override by default", () => {
    render(<App />);

    expect(screen.getByLabelText("Streaming target").textContent).toContain("localhost:49100");
    expect(screen.queryByLabelText(/^server$/i)).toBeNull();
    expect(screen.getByLabelText(/^resolution/i).textContent).toContain("FHD");
    expect(screen.getByLabelText(/^fps/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /advanced/i }));

    expect((screen.getByLabelText(/^server override$/i) as HTMLInputElement).value).toBe("localhost");
  });

  it("does not abort an in-progress stream with an app-level startup timeout", async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(remoteVideoAtConnect).not.toBeNull();
    vi.mocked(AppStreamer.terminate).mockClear();

    vi.advanceTimersByTime(13_000);

    expect(AppStreamer.terminate).not.toHaveBeenCalled();
  });

  it("uses a full-fit stream viewer by default and hides layout editing controls", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Fullscreen stream viewer")).toBeTruthy();
    });

    expect(screen.queryByTitle("Edit Layout")).toBeNull();
    expect(document.querySelector(".viewer-fit-shell")).not.toBeNull();
  });

  it("lets the compact viewer controls move away from the stream content", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Move viewer controls")).toBeTruthy();
    });

    const handle = screen.getByLabelText("Move viewer controls");
    const overlay = handle.closest(".viewer-overlay") as HTMLElement;
    const initialLeft = overlay.style.left;
    const initialTop = overlay.style.top;

    fireEvent.pointerDown(handle, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(overlay.style.left !== initialLeft || overlay.style.top !== initialTop).toBe(true);
  });

  it("can collapse the floating viewer controls", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Collapse viewer controls")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Collapse viewer controls"));

    const overlay = document.querySelector(".viewer-overlay") as HTMLElement;
    expect(overlay.className).toContain("collapsed");
    expect(screen.queryByText("Custom Kit App")).toBeNull();
    expect(screen.queryByText("FHD")).toBeNull();
    expect(screen.queryByLabelText("Move viewer controls")).toBeNull();
    expect(screen.queryByTitle("Fullscreen")).toBeNull();
    expect(overlay.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByLabelText("Expand viewer controls")).toBeTruthy();
  });

  it("does not expose layout editor handles in the default viewer mode", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Fullscreen stream viewer")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Move status panel")).toBeNull();
    expect(screen.queryByTitle("Save Layout")).toBeNull();
  });
});
