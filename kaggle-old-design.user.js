// ==UserScript==
// @name         Kaggle: старый дизайн
// @namespace    https://github.com/zabojeb/kaggle-theme
// @version      1.0.0
// @description  Полностью возвращает дизайн Kaggle до ребрендинга (цвета, шрифты, навигация, профили), выключая фича-флаг Rebrand.
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

  // Новый дизайн Kaggle включается клиентским фича-флагом `Rebrand`, а старый код
  // всё ещё лежит в бандле. Флаги приходят из RPC GetClientFeatureFlags и кешируются
  // в localStorage. Скрипт вычищает флаг из обоих мест до того, как стартует приложение.
  const FLAG = 'Rebrand';
  const CACHE_KEY = 'KAGGLE_FEATURE_FLAGS';
  const RPC = '/api/i/users.UsersService/GetClientFeatureFlags';

  const withoutFlag = (flags) => (Array.isArray(flags) ? flags.filter((f) => f !== FLAG) : flags);

  // 1. Кеш: если хеш флагов не поменялся, Kaggle берёт их отсюда и сеть не трогает.
  const setItem = Storage.prototype.setItem;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached?.flags?.includes(FLAG)) {
      cached.flags = withoutFlag(cached.flags);
      setItem.call(localStorage, CACHE_KEY, JSON.stringify(cached));
    }
  } catch {}

  // 2. Сеть: при смене хеша флаги перезапрашиваются, и приложение собирает
  //    их в памяти прямо из ответа, поэтому ответ правится до того, как его прочитают.
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

  // 3. Подстраховка на случай, если кеш запишут в обход ответа выше.
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
