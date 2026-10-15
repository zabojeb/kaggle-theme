// ==UserScript==
// @name         Kaggle Old Design
// @namespace    https://github.com/zabojeb/kaggle-theme
// @version      1.0.1
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
  // in localStorage. The script strips the flag from both places before the app starts.
  const FLAG = 'Rebrand';
  const CACHE_KEY = 'KAGGLE_FEATURE_FLAGS';
  const RPC = '/api/i/users.UsersService/GetClientFeatureFlags';

  const withoutFlag = (flags) => (Array.isArray(flags) ? flags.filter((f) => f !== FLAG) : flags);

  // 1. Cache: while the flags hash is unchanged, Kaggle reads flags from here and skips the network.
  const setItem = Storage.prototype.setItem;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached?.flags?.includes(FLAG)) {
      cached.flags = withoutFlag(cached.flags);
      setItem.call(localStorage, CACHE_KEY, JSON.stringify(cached));
    }
  } catch {}

  // 2. Network: when the hash changes, flags are refetched and the app builds its in-memory
  //    set straight from the response, so the response is patched before anyone reads it.
  const fetch = window.fetch;
  window.fetch = async function (input, init) {
    const response = await fetch.apply(this, arguments);
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (!url.includes(RPC)) return response;
    try {
      const data = await response.clone().json();
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

  // 3. Safety net in case the cache gets written without going through the response above.
  Storage.prototype.setItem = function (key, value) {
    if (key === CACHE_KEY && this === window.localStorage) {
      try {
        const data = JSON.parse(value);
        data.flags = withoutFlag(data.flags);
        value = JSON.stringify(data);
      } catch {}
    }
    return setItem.call(this, key, value);
  };
})();
