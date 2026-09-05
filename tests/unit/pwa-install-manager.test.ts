import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { canRegisterServiceWorker } from "@/components/pwa-install-manager";

describe("pwa install manager registration guards", () => {
  const originalWindow = global.window;
  const originalNavigator = global.navigator;

  function setGlobals(windowObj: any, navigatorObj: any) {
    Object.defineProperty(globalThis, "window", {
      value: windowObj,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorObj,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalWindow !== undefined) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    } else {
      delete (globalThis as any).window;
    }
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("rejects registration when not in secure context", () => {
    setGlobals({ isSecureContext: false }, { serviceWorker: { register: () => Promise.resolve() } });
    const result = canRegisterServiceWorker();
    assert.equal(result, false);
  });

  it("rejects registration when serviceWorker is unavailable", () => {
    setGlobals({ isSecureContext: true }, {});
    const result = canRegisterServiceWorker();
    assert.equal(result, false);
  });

  it("allows registration in secure context with serviceWorker", () => {
    setGlobals({ isSecureContext: true }, { serviceWorker: { register: () => Promise.resolve() } });
    const result = canRegisterServiceWorker();
    assert.equal(result, true);
  });
});
