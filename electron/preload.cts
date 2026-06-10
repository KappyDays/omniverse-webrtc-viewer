import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("omniverseViewer", {
  platform: process.platform,
});
