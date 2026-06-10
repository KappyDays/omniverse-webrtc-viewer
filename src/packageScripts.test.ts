import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("npm scripts", () => {
  it("keeps web:190 off localhost port 5174 to avoid the NVIDIA sample server collision", () => {
    expect(packageJson.scripts.dev).toBe("npm run web:190");
    expect(packageJson.scripts["web:190"]).toBe("vite --mode target190");
    expect(packageJson.scripts["app:190"]).toContain("http://127.0.0.1:5176");
    expect(packageJson.scripts["app:190"]).not.toContain("5174");
  });

  it("keeps web:195 on its dedicated port", () => {
    expect(packageJson.scripts["web:195"]).toBe("vite --mode target195");
    expect(packageJson.scripts["app:195"]).toContain("http://127.0.0.1:5175");
  });
});
