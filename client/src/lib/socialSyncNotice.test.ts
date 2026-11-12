import { describe, it, expect } from "vitest";
import { socialSyncNotice } from "./socialSyncNotice";

describe("socialSyncNotice – a Riportok oldal üzenete a közösségi ág eredményéből", () => {
  it("sikeres vagy nem kért szinkronnál nincs üzenet", () => {
    expect(socialSyncNotice({ status: "synced", inserted: 3, skippedAccounts: 0 })).toBeNull();
    expect(socialSyncNotice({ status: "skipped", reason: "not_requested" })).toBeNull();
    expect(socialSyncNotice(undefined)).toBeNull();
  });

  it("minden kimaradási okra rövid, tegező magyar szöveg", () => {
    expect(socialSyncNotice({ status: "skipped", reason: "not_configured" })).toMatch(/kimaradtak.*nincs beállítva/);
    expect(socialSyncNotice({ status: "skipped", reason: "no_external_ref" })).toMatch(/add meg/);
    expect(socialSyncNotice({ status: "skipped", reason: "no_match" })).toMatch(/Nézd meg/);
    expect(socialSyncNotice({ status: "failed", reason: "error", message: "Social Hub /clients: HTTP 503" })).toMatch(/Próbáld újra/);
  });
});
