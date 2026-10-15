// ==UserScript==
// @name         Kaggle Old Design
// @namespace    https://github.com/zabojeb/kaggle-theme
// @version      1.1.0
// @description  Fully restores Kaggle's pre-rebrand design (colors, fonts, navigation, profiles) by turning off the Rebrand feature flag.
// @homepageURL  https://github.com/zabojeb/kaggle-theme
// @supportURL   https://github.com/zabojeb/kaggle-theme/issues
// @updateURL    https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-design.user.js
// @downloadURL  https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-design.user.js
// @match        https://www.kaggle.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Kaggle's new design is gated by the client-side `Rebrand` feature flag, and the old code
  // still ships in the bundle. Flags come from the GetClientFeatureFlags RPC and are cached
  // in localStorage. The script hides the flag from the app while it runs, but never saves
  // the edited flags: storage keeps what the server sent, so turning the script off brings
  // the new design back on the next page load.
  const FLAG = 'Rebrand';
  const CACHE_KEY = 'KAGGLE_FEATURE_FLAGS';
  const RPC = '/api/i/users.UsersService/GetClientFeatureFlags';
  const REPAIRED_KEY = 'kaggle-old-design:cache-repaired';

  const withoutFlag = (flags) => (Array.isArray(flags) ? flags.filter((f) => f !== FLAG) : flags);
  const { getItem, setItem, removeItem } = Storage.prototype;
  const isFlagsCache = (storage, key) => key === CACHE_KEY && storage === window.localStorage;

  // Versions up to 1.0.1 saved the edited flags, which kept the old design even with the
  // script turned off. Drop that cache once so Kaggle refetches the real flags.
  try {
    if (!getItem.call(localStorage, REPAIRED_KEY)) {
      removeItem.call(localStorage, CACHE_KEY);
      setItem.call(localStorage, REPAIRED_KEY, '1');
    }
  } catch {}

  // 1. Cache: while the flags hash is unchanged, Kaggle reads flags from here and skips the network.
  Storage.prototype.getItem = function (key) {
    const value = getItem.call(this, key);
    if (value == null || !isFlagsCache(this, key)) return value;
    try {
      const data = JSON.parse(value);
      data.flags = withoutFlag(data.flags);
      return JSON.stringify(data);
    } catch {
      return value;
    }
  };

  // 2. Network: when the hash changes, flags are refetched and the app builds its in-memory
  //    set straight from the response, so the response is patched before anyone reads it.
  const serverFlags = new Map(); // flags hash → flags exactly as the server sent them
  const fetch = window.fetch;
  window.fetch = async function (input, init) {
    const response = await fetch.apply(this, arguments);
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (!url.includes(RPC)) return response;
    try {
      const data = await response.clone().json();
      serverFlags.set(data.hash, data.featureFlags);
      data.featureFlags = withoutFlag(data.featureFlags);
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };

  // 3. Kaggle then caches the patched response: store the server's flags instead.
  Storage.prototype.setItem = function (key, value) {
    if (isFlagsCache(this, key)) {
      try {
        const data = JSON.parse(value);
        if (serverFlags.has(data.hash)) {
          data.flags = serverFlags.get(data.hash);
          value = JSON.stringify(data);
        }
      } catch {}
    }
    return setItem.call(this, key, value);
  };
})();
