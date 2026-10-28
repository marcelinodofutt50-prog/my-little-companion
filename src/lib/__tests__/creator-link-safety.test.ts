import { describe, expect, it } from "vitest";
import { safeCreatorVideoHref } from "../creator-link-safety";

describe("Creator links are untrusted", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://m.instagram.com/reel/abc",
    "https://vm.tiktok.com/abc",
  ])("retains allowed HTTPS links: %s", (url) => {
    expect(safeCreatorVideoHref(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "http://youtube.com/watch?v=abc",
    "https://youtube.com.evil.example/video",
    "https://youtube.com@evil.example/video",
    "https://user:secret@youtube.com/video",
    "https://youtube.com:8443/video",
    "https://evil.example/video",
    "https://youtube.com\\@evil.example/video",
    "https://youtube.com/\nvideo",
    "//youtube.com/video",
    "not a URL",
  ])("disables unsafe stored links: %s", (url) => {
    expect(safeCreatorVideoHref(url)).toBeNull();
  });
});