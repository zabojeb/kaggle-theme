// ==UserScript==
// @name         Kaggle Old Medals
// @namespace    https://github.com/zabojeb/kaggle-theme
// @version      1.0.0
// @description  Restores Kaggle's pre-rebrand medal design: medal icons everywhere on the site and the medal on competition certificates. Everything else stays as is.
// @homepageURL  https://github.com/zabojeb/kaggle-theme
// @supportURL   https://github.com/zabojeb/kaggle-theme/issues
// @updateURL    https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-medals.user.js
// @downloadURL  https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-medals.user.js
// @match        https://www.kaggle.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Kaggle's bundle picks medal artwork with the `Rebrand` feature flag, and the old files
  // are still served by kaggle.com, so the new paths are simply swapped for the old ones.

  // Medal icons (<img>): leaderboards, rankings, profiles, notebooks, datasets, discussions.
  const ICON = /\/static\/images\/medals\/(gold|silver|bronze)-medal-new\.svg/;
  const OLD_ICON = '/static/images/medals/competitions/$1l@2x.png';

  // Competition certificates fetch the medal SVG and inline it, filling in the year.
  const CERTIFICATE = /\/static\/images\/competitions\/(gold|silver|bronze)-medal-new\.svg/;
  const OLD_CERTIFICATE = '/static/images/competitions/$1-medal.svg';

  const fetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && CERTIFICATE.test(input)) {
      input = input.replace(CERTIFICATE, OLD_CERTIFICATE);
    }
    return fetch.call(this, input, init);
  };

  function fixImg(img) {
    const src = img.getAttribute('src');
    if (src && ICON.test(src)) img.setAttribute('src', src.replace(ICON, OLD_ICON));
  }

  function fixImages(root) {
    if (root.tagName === 'IMG') fixImg(root);
    root.querySelectorAll?.('img[src*="-medal-new.svg"]').forEach(fixImg);
  }

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') fixImg(m.target);
      else for (const node of m.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) fixImages(node);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  fixImages(document);
})();
