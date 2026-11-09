import { describe, expect, it } from "vitest";
import { createChatOperations, readChatDraft } from "../chat-operations";

describe("chat operation locks", () => {
  it("blocks a second send before a render occurs", () => {
    const operations = createChatOperations();
    const release = operations.begin("compose");
    expect(release).not.toBeNull();
    expect(operations.begin("compose")).toBeNull();
    release?.();
    expect(operations.begin("compose")).not.toBeNull();
  });
  it("blocks simultaneous retries of the same message without blocking other messages", () => {
    const operations = createChatOperations();
    operations.begin("retry:message-a");
    expect(operations.begin("retry:message-a")).toBeNull();
    expect(operations.begin("retry:message-b")).not.toBeNull();
  });
  it("old upload completion cannot release the upload of another visit, including A-B-A", () => {
    const operations = createChatOperations();
    const releaseA = operations.begin("upload");
    operations.reset();
    operations.reset();
    operations.begin("upload");
    releaseA?.();
    expect(operations.begin("upload")).toBeNull();
  });
  it("prevents two history requests for the same cursor", () => {
    const operations = createChatOperations();
    operations.begin("history");
    expect(operations.begin("history")).toBeNull();
    expect(operations.begin("refresh")).not.toBeNull();
  });
});

describe("chat drafts", () => {
  it("returns an empty draft when browser storage is denied", () => {
    expect(readChatDraft("user:other-thread", { getItem() { throw new Error("denied"); } })).toBe("");
  });
  it("restores only the requested conversation and enforces the server length limit", () => {
    const drafts: Record<string, string> = { "user:A": "rascunho A", "user:B": "b".repeat(4500) };
    const storage = { getItem: (key: string) => drafts[key] ?? null };
    expect(readChatDraft("user:A", storage)).toBe("rascunho A");
    expect(readChatDraft("user:B", storage)).toHaveLength(4000);
    expect(readChatDraft("other-user:A", storage)).toBe("");
  });
});