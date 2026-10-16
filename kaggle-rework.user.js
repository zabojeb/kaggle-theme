// ==UserScript==
// @name         Kaggle Rework
// @namespace    https://github.com/zabojeb/kaggle-theme
// @version      1.0.0
// @description  A more polished, modern take on Kaggle's new design: readable text, soft surfaces and a glass top bar, plus a command palette, keyboard shortcuts, live competition deadlines, a quick theme switch and nicer notebooks. Every part can be turned off in its settings.
// @homepageURL  https://github.com/zabojeb/kaggle-theme
// @supportURL   https://github.com/zabojeb/kaggle-theme/issues
// @updateURL    https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-rework.user.js
// @downloadURL  https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-rework.user.js
// @match        https://www.kaggle.com/*
// @match        https://www.kaggleusercontent.com/kf/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Notebooks are rendered in an iframe on www.kaggleusercontent.com.
  if (location.hostname === 'www.kaggleusercontent.com') {
    notebookFrame();
    return;
  }

  const VERSION = '1.0.0';
  const REPO_URL = 'https://github.com/zabojeb/kaggle-theme';
  const SETTINGS_KEY = 'kaggle-rework:settings';
  const RECENT_KEY = 'kaggle-rework:recent';
  const NOTEBOOK_ORIGIN = 'https://www.kaggleusercontent.com';
  const TOP_BAR = 'nav[aria-label="Main menu, search and your account"]';
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = IS_MAC ? '⌘' : 'Ctrl';

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  const DEFAULTS = {
    readableText: true,
    modernSurfaces: true,
    glassHeader: true,
    visibleFocus: true,
    typography: true,
    contentWidth: 'default',
    density: 'comfortable',
    commandPalette: true,
    shortcuts: true,
    themeSwitch: true,
    deadlines: true,
    readingProgress: true,
    backToTop: true,
    notebooks: true,
  };
  const CHOICES = {
    contentWidth: ['default', 'wide', 'full'],
    density: ['comfortable', 'compact'],
  };

  const SETTINGS_SPEC = [
    {
      title: 'Look and feel',
      items: [
        { key: 'readableText', title: 'Readable text', desc: 'Regular weight instead of light for body text, so small text is easier to read.' },
        { key: 'modernSurfaces', title: 'Modern surfaces', desc: 'Soft layered shadows, lighter borders and a gentle lift on cards.' },
        { key: 'glassHeader', title: 'Glass top bar', desc: 'A translucent top bar that blurs the page scrolling behind it.' },
        { key: 'visibleFocus', title: 'Visible focus', desc: 'Clear blue focus rings when you move around with the keyboard.' },
        { key: 'typography', title: 'Typography polish', desc: 'Even-width numbers in tables and leaderboards, balanced headings, nicer selection and slim scrollbars.' },
        { key: 'contentWidth', title: 'Content width', desc: 'How wide pages can get on large screens.', choices: [['default', 'Default'], ['wide', 'Wide'], ['full', 'Full']] },
        { key: 'density', title: 'Density', desc: 'Row spacing in Kaggle lists and leaderboards.', choices: [['comfortable', 'Comfortable'], ['compact', 'Compact']] },
      ],
    },
    {
      title: 'Features',
      items: [
        { key: 'commandPalette', title: 'Command palette', desc: `${MOD} K to jump anywhere, reopen recent pages, search Kaggle and run actions.` },
        { key: 'shortcuts', title: 'Keyboard shortcuts', desc: 'G then a letter to switch sections, / to search, [ and ] to switch tabs. Press ? for the full list.' },
        { key: 'themeSwitch', title: 'Theme switch', desc: 'A light and dark toggle in the top bar. Needs a signed-in account.' },
        { key: 'deadlines', title: 'Live deadlines', desc: 'A countdown on competition pages, with every deadline in your time zone.' },
        { key: 'readingProgress', title: 'Reading progress', desc: 'A thin progress bar on notebooks, discussions and writeups.' },
        { key: 'backToTop', title: 'Back to top', desc: 'A button to jump back up on long pages.' },
        { key: 'notebooks', title: 'Modern notebooks', desc: 'Google Sans fonts, rounded code blocks, copy buttons and clean tables in notebooks.' },
      ],
    },
  ];

  const settings = loadSettings();
  const settingListeners = new Set();

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function loadSettings() {
    const stored = readJson(SETTINGS_KEY) || {};
    const result = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      const value = stored[key];
      const valid = CHOICES[key] ? CHOICES[key].includes(value) : typeof value === typeof DEFAULTS[key];
      if (valid) result[key] = value;
    }
    return result;
  }

  function setSetting(key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    writeJson(SETTINGS_KEY, settings);
    settingListeners.forEach((listener) => listener(key));
  }

  // ---------------------------------------------------------------------------
  // Design: CSS rewriting
  // ---------------------------------------------------------------------------

  // Kaggle's components are styled with styled-components and MUI (emotion). Both inject
  // rules through CSSStyleSheet.insertRule with theme values baked in as literals. A few of
  // those literals are rewritten into CSS variables that fall back to the original value,
  // so every design tweak below can be switched on and off live without touching the app.
  const FOCUS_COLOR = /#B3C8CE\b|rgb\(\s*179,\s*200,\s*206\s*\)/gi;
  const HAIRLINE_COLOR = /#(?:DADCE0|D9D9D9)\b|rgb\(\s*(?:218,\s*220,\s*224|217,\s*217,\s*217)\s*\)/gi;
  const MATERIAL_SHADOW = /rgba\(\s*60\s*,\s*64\s*,\s*67\s*,/i;
  const nativeInsertRule = CSSStyleSheet.prototype.insertRule;

  // Kaggle's Material elevation shadows, mapped to levels 1-5 by their largest length.
  function elevationLevel(value) {
    if (!MATERIAL_SHADOW.test(value) || /inset/i.test(value)) return 0;
    const largest = Math.max(0, ...(value.match(/\d*\.?\d+px/g) || []).map(parseFloat));
    return largest <= 3 ? 1 : largest <= 6 ? 2 : largest <= 8 ? 3 : largest <= 10 ? 4 : 5;
  }

  function rewriteValue(property, value, selector) {
    if (value.includes('var(--kr-')) return value;
    const [, core, important = ''] = value.match(/^([\s\S]*?)(\s*!important\s*)?$/);
    let next = core;
    if (property === 'font-weight') {
      if (/^\s*300\s*$/.test(core)) next = 'var(--kr-weight-light,300)';
    } else if (property === 'max-width') {
      if (/^\s*1200px\s*$/.test(core)) next = 'var(--kr-content-width,1200px)';
    } else if (property === 'box-shadow') {
      const level = elevationLevel(core);
      if (level) next = `var(--kr-elev-${level},${core.trim()})`;
    } else if (property === 'padding' && selector.includes('km-listitem--small')) {
      // Rows of Kaggle's lists and leaderboards; the density setting tightens them.
      if (/^\s*16px\s*$/.test(core)) next = 'var(--kr-list-padding,16px)';
    }
    if (/focus/i.test(selector) && /^(?:outline|outline-color|box-shadow|border|border-color)$/.test(property)) {
      next = next.replace(FOCUS_COLOR, 'var(--kr-focus,$&)');
    } else if (/^border(?:-(?:top|right|bottom|left))?(?:-color)?$/.test(property)) {
      next = next.replace(HAIRLINE_COLOR, 'var(--kr-hairline,$&)');
    }
    return next === core ? value : next + important;
  }

  function rewriteRule(rule) {
    if (/^\s*@(?:font-face|import|charset|namespace|(?:-webkit-)?keyframes)\b/i.test(rule)) return rule;
    return rule.replace(/([^{}]*)\{([^{}]*)\}/g, (block, selector, body) => {
      const next = body.replace(/(^|;)(\s*)([-\w]+)(\s*:)([^;]*)/g, (declaration, separator, space, property, colon, value) => {
        const rewritten = rewriteValue(property.toLowerCase(), value, selector);
        return rewritten === value ? declaration : separator + space + property + colon + rewritten;
      });
      return next === body ? block : `${selector}{${next}}`;
    });
  }

  function isAppSheet(sheet) {
    const owner = sheet.ownerNode;
    return Boolean(owner && owner.nodeType === 1 && (owner.hasAttribute('data-styled') || owner.hasAttribute('data-emotion')));
  }

  function installCssRewriter() {
    CSSStyleSheet.prototype.insertRule = function (rule, index) {
      if (typeof rule === 'string' && isAppSheet(this)) {
        let next = rule;
        try {
          next = rewriteRule(rule);
        } catch {}
        if (next !== rule) {
          try {
            return nativeInsertRule.call(this, next, index);
          } catch {}
        }
      }
      return nativeInsertRule.apply(this, arguments);
    };
  }

  // Rules inserted before the script ran (if any) get the same treatment.
  function retrofitSheets() {
    for (const node of document.querySelectorAll('style[data-styled], style[data-emotion]')) {
      const sheet = node.sheet;
      if (!sheet) continue;
      for (let index = 0; index < sheet.cssRules.length; index++) {
        const text = sheet.cssRules[index].cssText;
        let next = text;
        try {
          next = rewriteRule(text);
        } catch {}
        if (next === text) continue;
        try {
          nativeInsertRule.call(sheet, next, index);
          sheet.deleteRule(index + 1);
        } catch {}
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Design: page styles
  // ---------------------------------------------------------------------------

  const TOP_BAR_SURFACE = `${TOP_BAR} > div:last-child`;
  const CARD = '#site-content [role="list"] > [role="listitem"]:has(a[href])';

  const BASE_CSS = `
html.kr-readable { --kr-weight-light: 400; }
html.kr-focus { --kr-focus: #4D94FF; }
html.kr-width-wide { --kr-content-width: 1440px; }
html.kr-width-full { --kr-content-width: 100%; }

html.kr-surfaces {
  --kr-hairline: #E6E6E6;
  --kr-elev-1: 0 1px 2px rgb(18 18 24 / 5%), 0 1px 3px rgb(18 18 24 / 5%);
  --kr-elev-2: 0 1px 2px rgb(18 18 24 / 5%), 0 6px 16px -4px rgb(18 18 24 / 12%);
  --kr-elev-3: 0 2px 4px rgb(18 18 24 / 4%), 0 14px 32px -10px rgb(18 18 24 / 20%);
  --kr-elev-4: 0 4px 8px rgb(18 18 24 / 5%), 0 22px 44px -14px rgb(18 18 24 / 26%);
  --kr-elev-5: 0 8px 16px rgb(18 18 24 / 6%), 0 32px 64px -18px rgb(18 18 24 / 32%);
}
html.kr-surfaces.kr-dark {
  --kr-elev-1: 0 1px 2px rgb(0 0 0 / 35%);
  --kr-elev-2: 0 6px 16px -4px rgb(0 0 0 / 50%);
  --kr-elev-3: 0 14px 32px -10px rgb(0 0 0 / 60%);
  --kr-elev-4: 0 22px 44px -14px rgb(0 0 0 / 66%);
  --kr-elev-5: 0 32px 64px -18px rgb(0 0 0 / 72%);
}
html.kr-surfaces ${CARD} {
  box-shadow: var(--kr-elev-1);
  transition: transform .3s cubic-bezier(.2, .8, .2, 1), box-shadow .3s ease, border-color .3s ease;
}
html.kr-surfaces ${CARD}:hover {
  box-shadow: var(--kr-elev-3);
  transform: translateY(-3px);
}
:where(html.kr-surfaces #site-content) :where(a, button, [role="button"], [role="tab"], [role="option"]) {
  transition-property: color, background-color, border-color, box-shadow, opacity;
  transition-duration: .18s;
  transition-timing-function: ease;
}

html.kr-glass ${TOP_BAR_SURFACE} {
  background-color: rgb(255 255 255 / 76%) !important;
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  /* Kaggle slides the bar away while scrolling down; keep that animation. */
  transition: transform .5s, box-shadow .25s ease;
}
html.kr-glass.kr-dark ${TOP_BAR_SURFACE} { background-color: rgb(24 24 24 / 72%) !important; }
html.kr-glass.kr-scrolled ${TOP_BAR_SURFACE} { box-shadow: 0 1px 0 rgb(0 0 0 / 6%), 0 12px 24px -20px rgb(0 0 0 / 40%); }
html.kr-glass.kr-dark.kr-scrolled ${TOP_BAR_SURFACE} { box-shadow: 0 1px 0 rgb(255 255 255 / 6%), 0 12px 24px -20px rgb(0 0 0 / 80%); }

html.kr-typography { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
html.kr-typography #site-content :is(h1, h2, h3, h4) { text-wrap-style: balance; }
html.kr-typography #site-content h1 { letter-spacing: -0.015em; }
html.kr-typography #site-content :is(p, li) { text-wrap-style: pretty; }
html.kr-typography :is(.km-list, .MuiTable-root, table, [role="table"], [role="grid"]) { font-variant-numeric: tabular-nums; }
html.kr-typography ::selection { background-color: rgb(255 196 18 / 40%); }
html.kr-typography #site-content { scrollbar-width: thin; scrollbar-color: rgb(31 31 31 / 24%) transparent; }
html.kr-typography.kr-dark #site-content { scrollbar-color: rgb(255 255 255 / 22%) transparent; }

html.kr-compact { --kr-list-padding: 9px 16px; }

@media (prefers-reduced-motion: reduce) {
  html.kr-surfaces ${CARD}, html.kr-surfaces ${CARD}:hover { transform: none; transition: none; }
}
`;

  function applyDesignClasses() {
    const classes = document.documentElement.classList;
    classes.toggle('kr-readable', settings.readableText);
    classes.toggle('kr-surfaces', settings.modernSurfaces);
    classes.toggle('kr-glass', settings.glassHeader);
    classes.toggle('kr-focus', settings.visibleFocus);
    classes.toggle('kr-typography', settings.typography);
    classes.toggle('kr-width-wide', settings.contentWidth === 'wide');
    classes.toggle('kr-width-full', settings.contentWidth === 'full');
    classes.toggle('kr-compact', settings.density === 'compact');
  }

  // Kaggle marks the current theme with a class on #site-content.
  let darkTheme = false;

  function syncTheme() {
    const dark = Boolean(document.querySelector('.legacy-less-dark-theme'));
    if (dark === darkTheme) return;
    darkTheme = dark;
    document.documentElement.classList.toggle('kr-dark', dark);
    for (const host of document.querySelectorAll(HOST_TAGS)) host.dataset.theme = dark ? 'dark' : 'light';
    renderActions(true);
  }

  // ---------------------------------------------------------------------------
  // Kaggle app access
  // ---------------------------------------------------------------------------

  const scroller = () => document.getElementById('site-content');

  function reactFiber(node) {
    if (!node) return null;
    const key = Object.keys(node).find((name) => name.startsWith('__reactFiber$'));
    return key ? node[key] : null;
  }

  function findInFibers(node, pick, maxDepth = 200) {
    for (let fiber = reactFiber(node), depth = 0; fiber && depth < maxDepth; fiber = fiber.return, depth++) {
      const found = pick(fiber);
      if (found) return found;
    }
    return null;
  }

  // React context values provided above the page content (router, theme, current user).
  function contextValue(test) {
    return findInFibers(scroller(), (fiber) => {
      const value = fiber.memoizedProps?.value;
      return value && typeof value === 'object' && test(value) ? value : null;
    }, 400);
  }

  const routerNavigator = () => contextValue((value) => typeof value.navigator?.push === 'function')?.navigator || null;
  const themeContext = () => contextValue((value) => typeof value.updateTheme === 'function' && 'darkModeEnabled' in value);
  const currentUser = () => contextValue((value) => 'currentUser' in value)?.currentUser || null;
  const isSignedIn = () => Boolean(currentUser()?.id);

  function profileUrl() {
    const user = currentUser();
    return user?.profileUrl || (user?.userName ? `/${user.userName}` : null);
  }

  function navigate(url, newTab = false) {
    const target = new URL(url, location.href);
    if (newTab) {
      window.open(target.href, '_blank', 'noopener');
      return;
    }
    const router = target.origin === location.origin ? routerNavigator() : null;
    if (!router) {
      location.assign(target.href);
      return;
    }
    router.push(target.pathname + target.search + target.hash);
    scroller()?.scrollTo({ top: 0 });
  }

  const routeListeners = new Set();
  let routePath = location.pathname;

  function checkRoute() {
    if (location.pathname === routePath) return;
    routePath = location.pathname;
    routeListeners.forEach((listener) => listener());
  }

  function watchHistory() {
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        queueMicrotask(checkRoute);
        return result;
      };
    }
    window.addEventListener('popstate', () => queueMicrotask(checkRoute));
  }

  const isEditorPage = () => /\/edit(?:\/|$)/.test(location.pathname);
  const ARTICLE_PAGE = /^\/(?:code\/[^/]+\/[^/]+(?:\/notebook)?|discussions\/[^/]+\/\d+|competitions\/[^/]+\/(?:discussion\/\d+|writeups\/[^/]+)|docs(?:\/.*)?|learn\/[^/]+(?:\/.*)?)\/?$/;
  const isArticlePage = () => ARTICLE_PAGE.test(location.pathname);

  function pageTabs() {
    const list = document.querySelector('#site-content [role="tablist"]');
    if (!list) return [];
    return [...list.querySelectorAll('a[role="tab"][href]')].map((element) => ({
      element,
      title: element.textContent.trim(),
      url: element.getAttribute('href'),
      selected: element.getAttribute('aria-selected') === 'true',
    }));
  }

  function searchInput() {
    return [...document.querySelectorAll(`${TOP_BAR} input`)].find((input) => input.offsetParent !== null) || null;
  }

  const kaggleDialogOpen = () => Boolean(document.querySelector('.MuiModal-root:not(.MuiModal-hidden), [role="dialog"][aria-modal="true"]'));

  // ---------------------------------------------------------------------------
  // Recently viewed pages
  // ---------------------------------------------------------------------------

  const RESERVED_PATHS = new Set([
    'about', 'account', 'api', 'benchmarks', 'blog', 'c', 'certification', 'code', 'community-guidelines', 'competitions',
    'contact', 'datasets', 'discussions', 'docs', 'edu', 'game-arena', 'groups', 'kernels', 'learn', 'login', 'me',
    'models', 'notifications', 'organizations', 'privacy', 'progression', 'rankings', 'research-grants', 'search',
    'settings', 'signin', 'static', 'terms', 'work', 'writeups',
  ]);
  const PAGE_KINDS = [
    { kind: 'discussion', label: 'Discussion', icon: 'forum', pattern: /^\/(?:discussions\/[^/]+|competitions\/[^/]+\/discussion)\/\d+/ },
    { kind: 'writeup', label: 'Writeup', icon: 'article', pattern: /^\/competitions\/[^/]+\/writeups\/[^/]+/ },
    { kind: 'competition', label: 'Competition', icon: 'emoji_events', pattern: /^\/competitions\/[^/]+/ },
    { kind: 'dataset', label: 'Dataset', icon: 'table_chart', pattern: /^\/datasets\/[^/]+\/[^/]+/ },
    { kind: 'model', label: 'Model', icon: 'model_training', pattern: /^\/models\/[^/]+\/[^/]+/ },
    { kind: 'notebook', label: 'Notebook', icon: 'code', pattern: /^\/code\/[^/]+\/[^/]+/ },
    { kind: 'profile', label: 'Profile', icon: 'account_circle', pattern: /^\/[\w-]+$/, test: (path) => !RESERVED_PATHS.has(path.slice(1).toLowerCase()) },
  ];
  const GENERIC_TITLE = /^(?:kaggle(?::.*)?)?$/i;
  let staleTitle = null;

  function pageKind(path) {
    for (const kind of PAGE_KINDS) {
      const match = path.match(kind.pattern);
      if (match && (!kind.test || kind.test(path))) return { ...kind, url: match[0] };
    }
    return null;
  }

  function recordVisit() {
    const kind = pageKind(location.pathname);
    const title = document.title.replace(/\s*\|\s*Kaggle\s*$/, '').trim();
    // Right after a navigation the title still belongs to the previous page.
    if (!kind || GENERIC_TITLE.test(title) || document.title === staleTitle) return;
    const recent = (readJson(RECENT_KEY) || []).filter((entry) => entry?.url && entry.url !== kind.url);
    recent.unshift({ url: kind.url, title, kind: kind.kind, time: Date.now() });
    writeJson(RECENT_KEY, recent.slice(0, 30));
  }

  function watchTitle() {
    let timer = 0;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(recordVisit, 400);
    }).observe(document.head, { childList: true, subtree: true, characterData: true });
    recordVisit();
  }

  // ---------------------------------------------------------------------------
  // UI building blocks
  // ---------------------------------------------------------------------------

  const HOST_TAGS = 'kaggle-rework-ui, kaggle-rework-actions, kaggle-rework-countdown';

  const TOKENS_CSS = `
:host {
  all: initial;
  --kr-bg: #FFFFFF;
  --kr-bg-soft: #F8F8F8;
  --kr-bg-hover: #F1F1F1;
  --kr-bg-active: #E0E0E0;
  --kr-border: #E6E6E6;
  --kr-text: #1F1F1F;
  --kr-text-2: #5A5A5A;
  --kr-text-3: #8A8A8A;
  --kr-accent: #FFC412;
  --kr-focus-ring: #4D94FF;
  --kr-invert-bg: #1F1F1F;
  --kr-invert-text: #FFFFFF;
  --kr-scrim: rgb(31 31 31 / 30%);
  --kr-shadow: 0 2px 6px rgb(18 18 24 / 6%), 0 28px 64px -20px rgb(18 18 24 / 34%);
  font-family: "Google Sans Flex", Inter, system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: var(--kr-text);
  -webkit-font-smoothing: antialiased;
}
:host([data-theme="dark"]) {
  --kr-bg: #1F1F1F;
  --kr-bg-soft: #262626;
  --kr-bg-hover: #2E2E2E;
  --kr-bg-active: #474747;
  --kr-border: #363636;
  --kr-text: #F1F1F1;
  --kr-text-2: #B8B8B8;
  --kr-text-3: #8A8A8A;
  --kr-invert-bg: #F1F1F1;
  --kr-invert-text: #1F1F1F;
  --kr-scrim: rgb(0 0 0 / 55%);
  --kr-shadow: 0 2px 6px rgb(0 0 0 / 40%), 0 28px 64px -20px rgb(0 0 0 / 75%);
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.icon {
  display: inline-block;
  flex: none;
  width: 1em;
  overflow: hidden;
  font-family: "Google Symbols";
  font-size: 20px;
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  direction: ltr;
  font-feature-settings: "liga";
  font-variation-settings: "FILL" 0, "wght" 300;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--kr-border);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--kr-bg-soft);
  color: var(--kr-text-2);
  font: 500 11px/1 "Google Sans Flex", Inter, system-ui, sans-serif;
}
`;

  const UI_CSS = `
.progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147482000;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #FFC412, #FF9A1F);
  transform: scaleX(0);
  transform-origin: 0 50%;
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s ease;
}
.progress.on { opacity: 1; }
.top {
  all: unset;
  position: fixed;
  right: 28px;
  bottom: calc(28px + var(--kr-bottom-inset, 0px));
  z-index: 2147482000;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--kr-invert-bg);
  color: var(--kr-invert-text);
  box-shadow: 0 12px 28px -10px rgb(0 0 0 / 45%);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(12px) scale(.92);
  transition: opacity .2s ease, transform .25s cubic-bezier(.2, .8, .2, 1), visibility .2s;
}
.top.show { opacity: 1; visibility: visible; transform: none; }
.top.show:hover { transform: translateY(-2px); }
.top:focus-visible { outline: 2px solid var(--kr-focus-ring); outline-offset: 3px; }
.top .icon { font-size: 22px; }
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(32px + var(--kr-bottom-inset, 0px));
  z-index: 2147483600;
  max-width: calc(100vw - 32px);
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--kr-invert-bg);
  color: var(--kr-invert-text);
  box-shadow: var(--kr-shadow);
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 12px);
  pointer-events: none;
  transition: opacity .2s ease, transform .2s ease, visibility .2s;
}
.toast.show { opacity: 1; visibility: visible; transform: translate(-50%, 0); }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483500;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
  background: var(--kr-scrim);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}
.overlay.open { display: flex; animation: kr-fade .16s ease; }
.dialog, .panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--kr-border);
  background: var(--kr-bg);
  color: var(--kr-text);
  box-shadow: var(--kr-shadow);
  animation: kr-rise .2s cubic-bezier(.2, .8, .2, 1);
}

.dialog { width: min(640px, 100%); max-height: min(580px, 76vh); border-radius: 20px; }
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--kr-border);
  color: var(--kr-text-3);
}
.search .icon { font-size: 22px; }
.search input {
  all: unset;
  flex: 1;
  min-width: 0;
  color: var(--kr-text);
  font-size: 17px;
  line-height: 1.4;
}
.search input::placeholder { color: var(--kr-text-3); }
.results { flex: 1; overflow-y: auto; padding: 6px 8px 8px; overscroll-behavior: contain; scrollbar-width: thin; }
.section { padding: 12px 12px 6px; color: var(--kr-text-3); font-size: 12px; font-weight: 500; }
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  cursor: pointer;
}
.item.active { background: var(--kr-bg-hover); }
.item .icon { color: var(--kr-text-2); }
.item .title { flex: 1; min-width: 0; overflow: hidden; font-size: 14px; white-space: nowrap; text-overflow: ellipsis; }
.item .sub { flex: none; color: var(--kr-text-3); font-size: 12px; }
.item .keys { flex: none; display: inline-flex; gap: 4px; }
mark {
  background: none;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--kr-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--kr-border);
  color: var(--kr-text-3);
  font-size: 12px;
}
.footer span { display: inline-flex; align-items: center; gap: 4px; }
.footer .brand { margin-left: auto; }

.panel { width: min(600px, 100%); max-height: min(760px, 86vh); border-radius: 24px; }
.panel header { display: flex; align-items: flex-start; gap: 12px; padding: 22px 24px 10px; }
.panel h2 { margin: 0; font: 400 26px/1.15 "FG Futurist", "Google Sans Flex", sans-serif; letter-spacing: -0.01em; }
.panel .version { margin-top: 4px; color: var(--kr-text-3); font-size: 12px; }
.icon-button {
  all: unset;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-left: auto;
  border-radius: 50%;
  color: var(--kr-text-2);
  cursor: pointer;
}
.icon-button:hover { background: var(--kr-bg-hover); color: var(--kr-text); }
.icon-button:focus-visible, .switch:focus-visible, .segmented button:focus-visible, .btn:focus-visible {
  outline: 2px solid var(--kr-focus-ring);
  outline-offset: 2px;
}
.body { overflow-y: auto; padding: 0 24px 18px; overscroll-behavior: contain; scrollbar-width: thin; }
.group-title { margin: 18px 0 8px; color: var(--kr-text-3); font-size: 13px; font-weight: 500; }
.group { padding: 0 16px; border: 1px solid var(--kr-border); border-radius: 16px; }
.row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--kr-border); }
.row:last-child { border-bottom: 0; }
.row .text { flex: 1; min-width: 0; }
.row .name { font-size: 15px; font-weight: 500; }
.row .desc { margin-top: 3px; color: var(--kr-text-2); font-size: 13px; line-height: 1.45; }
.switch {
  all: unset;
  position: relative;
  flex: none;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--kr-bg-active);
  cursor: pointer;
  transition: background-color .2s ease;
}
.switch::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
  transition: transform .22s cubic-bezier(.2, .8, .2, 1);
}
.switch[aria-checked="true"] { background: var(--kr-invert-bg); }
.switch[aria-checked="true"]::after { transform: translateX(16px); background: var(--kr-invert-text); }
.segmented { flex: none; display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--kr-bg-hover); }
.segmented button {
  all: unset;
  padding: 7px 12px;
  border-radius: 999px;
  color: var(--kr-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.segmented button[aria-checked="true"] { background: var(--kr-bg); color: var(--kr-text); box-shadow: 0 1px 3px rgb(0 0 0 / 14%); }
.panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--kr-border);
}
.btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--kr-border);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn:hover { background: var(--kr-bg-hover); }
.link { color: var(--kr-text-2); font-size: 13px; text-underline-offset: 3px; }
.shortcuts { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; padding-top: 6px; }
.shortcut {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--kr-border);
  font-size: 14px;
}
.shortcut .keys { display: inline-flex; align-items: center; gap: 4px; color: var(--kr-text-3); font-size: 12px; }

@keyframes kr-fade { from { opacity: 0; } }
@keyframes kr-rise { from { opacity: 0; transform: translateY(10px) scale(.985); } }
@media (prefers-reduced-motion: reduce) {
  .overlay.open, .dialog, .panel { animation: none; }
}
@media (max-width: 600px) {
  .shortcuts { grid-template-columns: 1fr; }
  .footer span:not(.brand) { display: none; }
}
`;

  const ACTIONS_CSS = `
:host { display: inline-flex; flex: none; align-items: center; gap: 4px; margin: 0 4px 0 12px; }
:host([data-in-row]) { margin: 0 -8px 0 0; }
@media (max-width: 839px) { :host { display: none; } }
button {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  min-width: 40px;
  border-radius: 999px;
  color: var(--kr-text-2);
  cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
button:hover { background: var(--kr-bg-hover); color: var(--kr-text); }
button:focus-visible { outline: 2px solid var(--kr-focus-ring); outline-offset: 2px; }
.jump { height: 36px; padding: 0 8px 0 12px; border: 1px solid var(--kr-border); font-size: 13px; }
.jump .label { margin-right: 4px; }
.round .icon { font-size: 22px; }
@media (max-width: 1199px) { .jump .label { display: none; } }
`;

  const COUNTDOWN_CSS = `
:host { position: relative; display: inline-flex; margin-left: 10px; vertical-align: middle; }
.pill {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px 0 7px;
  border-radius: 999px;
  background: rgb(255 196 18 / 22%);
  color: var(--kr-text);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
}
.pill .icon { font-size: 16px; }
.pill:focus-visible { outline: 2px solid var(--kr-focus-ring); outline-offset: 2px; }
.pill.soon { background: rgb(255 106 0 / 16%); color: #C74200; }
.pill.urgent { background: rgb(235 28 32 / 14%); color: #C71517; }
:host([data-theme="dark"]) .pill { background: rgb(255 196 18 / 18%); color: #FFD75E; }
:host([data-theme="dark"]) .pill.soon { background: rgb(255 106 0 / 22%); color: #FF8E3D; }
:host([data-theme="dark"]) .pill.urgent { background: rgb(255 55 58 / 22%); color: #FF6669; }
.pop {
  position: absolute;
  top: calc(100% + 8px);
  left: -8px;
  z-index: 60;
  width: 330px;
  padding: 6px;
  border: 1px solid var(--kr-border);
  border-radius: 16px;
  background: var(--kr-bg);
  box-shadow: var(--kr-shadow);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity .15s ease, transform .15s ease, visibility .15s;
}
.pop::before { content: ""; position: absolute; top: -10px; left: 0; right: 0; height: 10px; }
:host(:hover) .pop, :host(:focus-within) .pop, :host(.open) .pop { opacity: 1; visibility: visible; transform: none; }
.heading { padding: 8px 10px 6px; color: var(--kr-text-3); font-size: 12px; }
.milestone {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  column-gap: 10px;
  row-gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
}
.milestone:hover { background: var(--kr-bg-soft); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--kr-accent); }
.milestone.past { color: var(--kr-text-3); }
.milestone.past .dot { background: var(--kr-border); }
.label { font-size: 13px; font-weight: 500; }
.relative { color: var(--kr-text-2); font-size: 12px; }
.when { grid-column: 2 / 4; color: var(--kr-text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
/* On phones the list opens as a sheet at the bottom of the screen. */
@media (max-width: 600px) {
  .pop { position: fixed; top: auto; right: 16px; bottom: 16px; left: 16px; width: auto; }
  .pop::before { display: none; }
}
`;

  function el(tag, className = '', attributes = {}, text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (text) node.textContent = text;
    return node;
  }

  function createHost(tag, css, html = '') {
    const host = document.createElement(tag);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${TOKENS_CSS}${css}</style>${html}`;
    host.dataset.theme = darkTheme ? 'dark' : 'light';
    return { host, root };
  }

  function iconButton(icon, label, onClick) {
    const button = el('button', 'icon-button', { type: 'button', 'aria-label': label, title: label });
    button.append(el('span', 'icon', {}, icon));
    button.addEventListener('click', onClick);
    return button;
  }

  let uiParts = null;

  // Page-wide UI (progress bar, back-to-top button, toasts, dialogs) lives in one shadow root.
  function ui() {
    if (uiParts) return uiParts;
    const { host, root } = createHost('kaggle-rework-ui', UI_CSS, `
      <div class="progress"></div>
      <button type="button" class="top" aria-label="Back to top" title="Back to top"><span class="icon">arrow_upward</span></button>
      <div class="toast" role="status" aria-live="polite"></div>`);
    document.body.append(host);
    uiParts = {
      root,
      progress: root.querySelector('.progress'),
      top: root.querySelector('.top'),
      toast: root.querySelector('.toast'),
    };
    uiParts.top.addEventListener('click', () => scroller()?.scrollTo({ top: 0, behavior: 'smooth' }));
    return uiParts;
  }

  let toastTimer = 0;

  function toast(message) {
    const node = ui().toast;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast('Could not copy to the clipboard');
    }
  }

  const anyOverlayOpen = () => Boolean(uiParts?.root.querySelector('.overlay.open'));

  // ---------------------------------------------------------------------------
  // Dialogs: settings and keyboard shortcuts
  // ---------------------------------------------------------------------------

  const dialogs = {};

  function openDialog(name, build) {
    closePalette();
    closeDialogs();
    let overlay = dialogs[name];
    if (!overlay) {
      overlay = el('div', 'overlay');
      overlay.addEventListener('mousedown', (event) => {
        if (event.target === overlay) closeDialogs();
      });
      ui().root.append(overlay);
      dialogs[name] = overlay;
    }
    overlay.replaceChildren(build());
    overlay.classList.add('open');
    overlay.querySelector('.icon-button')?.focus();
  }

  function closeDialogs() {
    for (const overlay of Object.values(dialogs)) overlay.classList.remove('open');
  }

  function panelHeader(title, subtitle) {
    const header = el('header');
    const heading = el('div');
    heading.append(el('h2', '', {}, title), el('div', 'version', {}, subtitle));
    header.append(heading, iconButton('close', 'Close', closeDialogs));
    return header;
  }

  function settingRow(item) {
    const row = el('div', 'row');
    const text = el('div', 'text');
    text.append(el('div', 'name', {}, item.title), el('div', 'desc', {}, item.desc));
    row.append(text);
    if (item.choices) {
      const group = el('div', 'segmented', { role: 'radiogroup', 'aria-label': item.title });
      for (const [value, label] of item.choices) {
        const button = el('button', '', { type: 'button', role: 'radio', 'aria-checked': String(settings[item.key] === value) }, label);
        button.addEventListener('click', () => {
          setSetting(item.key, value);
          for (const option of group.children) option.setAttribute('aria-checked', String(option === button));
        });
        group.append(button);
      }
      row.append(group);
    } else {
      const toggle = el('button', 'switch', { type: 'button', role: 'switch', 'aria-label': item.title, 'aria-checked': String(settings[item.key]) });
      toggle.addEventListener('click', () => {
        setSetting(item.key, !settings[item.key]);
        toggle.setAttribute('aria-checked', String(settings[item.key]));
      });
      row.append(toggle);
    }
    return row;
  }

  function buildSettingsPanel() {
    const panel = el('div', 'panel', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Kaggle Rework settings' });
    const body = el('div', 'body');
    for (const group of SETTINGS_SPEC) {
      const box = el('div', 'group');
      for (const item of group.items) box.append(settingRow(item));
      body.append(el('div', 'group-title', {}, group.title), box);
    }
    const footer = el('footer');
    const reset = el('button', 'btn', { type: 'button' }, 'Reset to defaults');
    reset.addEventListener('click', () => {
      for (const [key, value] of Object.entries(DEFAULTS)) setSetting(key, value);
      openSettings();
      toast('Settings reset');
    });
    footer.append(reset, el('a', 'link', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Kaggle Rework on GitHub'));
    panel.append(panelHeader('Kaggle Rework', `Version ${VERSION}`), body, footer);
    return panel;
  }

  function buildHelpPanel() {
    const panel = el('div', 'panel', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard shortcuts' });
    const grid = el('div', 'shortcuts');
    const signedIn = isSignedIn();
    const rows = [
      [[MOD, 'K'], 'Command palette'],
      [['/'], 'Search Kaggle'],
      [['['], 'Previous tab'],
      [[']'], 'Next tab'],
      [['?'], 'Show shortcuts'],
      [['Esc'], 'Close dialogs'],
      ...DESTINATIONS.filter((target) => target.key && (!target.auth || signedIn)).map((target) => [['G', target.key.toUpperCase()], target.title]),
    ];
    for (const [keys, label] of rows) {
      const row = el('div', 'shortcut');
      const keyBox = el('span', 'keys');
      keys.forEach((key, index) => {
        if (index && keys[0] === 'G') keyBox.append('then');
        keyBox.append(el('kbd', '', {}, key));
      });
      row.append(el('span', '', {}, label), keyBox);
      grid.append(row);
    }
    const body = el('div', 'body');
    body.append(grid);
    panel.append(panelHeader('Keyboard shortcuts', 'Kaggle Rework'), body);
    return panel;
  }

  const openSettings = () => openDialog('settings', buildSettingsPanel);
  const openHelp = () => openDialog('help', buildHelpPanel);

  // ---------------------------------------------------------------------------
  // Command palette
  // ---------------------------------------------------------------------------

  const DESTINATIONS = [
    { key: 'h', title: 'Home', url: '/', icon: 'home' },
    { key: 'c', title: 'Competitions', url: '/competitions', icon: 'emoji_events' },
    { key: 'd', title: 'Datasets', url: '/datasets', icon: 'table_chart', keywords: 'data hub' },
    { key: 'm', title: 'Models', url: '/models', icon: 'model_training', keywords: 'data hub' },
    { key: 'n', title: 'Code', url: '/code', icon: 'code', keywords: 'notebooks kernels' },
    { key: 'f', title: 'Discussions', url: '/discussions', icon: 'forum', keywords: 'forums' },
    { key: 'l', title: 'Learn', url: '/learn', icon: 'school', keywords: 'courses' },
    { key: 'b', title: 'Benchmarks', url: '/benchmarks', icon: 'leaderboard' },
    { key: 'a', title: 'Game Arena', url: '/game-arena', icon: 'sports_esports' },
    { key: 'r', title: 'Rankings', url: '/rankings', icon: 'military_tech' },
    { title: 'Progression', url: '/progression', icon: 'trending_up', keywords: 'tiers medals' },
    { title: 'Documentation', url: '/docs', icon: 'menu_book', keywords: 'docs help api' },
    { key: 'w', title: 'Your Work', url: '/work', icon: 'note_alt', auth: true },
    { key: 'p', title: 'Your Profile', url: profileUrl, icon: 'account_circle', auth: true },
    { title: 'Your Groups', url: '/groups', icon: 'group', auth: true },
    { title: 'API tokens', url: '/settings/api', icon: 'key', auth: true },
    { key: 's', title: 'Account settings', url: '/settings', icon: 'settings', auth: true },
  ];
  const WIDTH_LABELS = { default: 'Default', wide: 'Wide', full: 'Full' };
  const SECTION_ORDER = ['Recent', 'Go to', 'This page', 'Actions'];
  const palette = { overlay: null, input: null, list: null, items: [], results: [], active: 0, returnFocus: null };

  function destinationUrl(target) {
    return typeof target.url === 'function' ? target.url() : target.url;
  }

  function paletteItems() {
    const items = [];
    const signedIn = isSignedIn();
    const current = pageKind(location.pathname)?.url;
    for (const entry of readJson(RECENT_KEY) || []) {
      if (!entry?.url || entry.url === current) continue;
      const kind = PAGE_KINDS.find((candidate) => candidate.kind === entry.kind);
      items.push({ section: 'Recent', title: entry.title, subtitle: kind?.label, icon: kind?.icon || 'history', url: entry.url });
    }
    for (const target of DESTINATIONS) {
      const url = !target.auth || signedIn ? destinationUrl(target) : null;
      if (!url) continue;
      const keys = target.key && settings.shortcuts ? ['G', target.key.toUpperCase()] : null;
      items.push({ section: 'Go to', title: target.title, icon: target.icon, url, keywords: target.keywords, keys });
    }
    for (const tab of pageTabs()) {
      items.push({ section: 'This page', title: tab.title, subtitle: tab.selected ? 'Current tab' : 'Tab', icon: 'tab', url: tab.url, keywords: 'tab' });
    }
    items.push({ section: 'This page', title: 'Copy link to this page', icon: 'link', keywords: 'url share', run: () => copyText(location.href, 'Link copied') });
    items.push({ section: 'This page', title: 'Scroll to top', icon: 'vertical_align_top', run: () => scroller()?.scrollTo({ top: 0, behavior: 'smooth' }) });
    items.push({
      section: 'This page',
      title: 'Scroll to bottom',
      icon: 'vertical_align_bottom',
      run: () => {
        const element = scroller();
        element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
      },
    });
    const theme = themeState();
    if (theme) {
      items.push({
        section: 'Actions',
        title: theme.dark ? 'Switch to light theme' : 'Switch to dark theme',
        icon: theme.dark ? 'light_mode' : 'dark_mode',
        keywords: 'theme appearance mode',
        run: () => setThemeMode(theme.dark ? 'light' : 'dark'),
      });
      if (theme.mode !== 'device') {
        items.push({ section: 'Actions', title: 'Follow the system theme', icon: 'brightness_auto', keywords: 'theme appearance device', run: () => setThemeMode('device') });
      }
    }
    for (const [value, label] of Object.entries(WIDTH_LABELS)) {
      if (value === settings.contentWidth) continue;
      items.push({
        section: 'Actions',
        title: `${label} content width`,
        icon: 'width_wide',
        keywords: 'layout wide full width',
        run: () => {
          setSetting('contentWidth', value);
          toast(`${label} content width`);
        },
      });
    }
    const compact = settings.density === 'compact';
    items.push({
      section: 'Actions',
      title: compact ? 'Comfortable density' : 'Compact density',
      icon: compact ? 'density_medium' : 'density_small',
      keywords: 'rows spacing layout',
      run: () => {
        setSetting('density', compact ? 'comfortable' : 'compact');
        toast(compact ? 'Comfortable density' : 'Compact density');
      },
    });
    items.push({ section: 'Actions', title: 'Kaggle Rework settings', icon: 'tune', keywords: 'preferences options', run: openSettings });
    items.push({ section: 'Actions', title: 'Keyboard shortcuts', icon: 'keyboard', keys: settings.shortcuts ? ['?'] : null, keywords: 'help keys', run: openHelp });
    return items;
  }

  function fuzzyScore(text, query) {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    if (!haystack || !needle) return 0;
    const at = haystack.indexOf(needle);
    if (at >= 0) {
      const wordStart = at === 0 || /[\s\-_/.·(]/.test(haystack[at - 1]);
      return 500 + (wordStart ? 300 : 0) - at - (haystack.length - needle.length) * 0.5;
    }
    let score = 0;
    let from = 0;
    let previous = -2;
    for (const char of needle.replace(/\s+/g, '')) {
      const found = haystack.indexOf(char, from);
      if (found < 0) return 0;
      score += found === previous + 1 ? 6 : 1;
      if (found === 0 || /[\s\-_/.]/.test(haystack[found - 1])) score += 4;
      previous = found;
      from = found + 1;
    }
    return score;
  }

  function matchScore(item, query) {
    return Math.max(fuzzyScore(item.title, query) * 2, fuzzyScore(item.keywords || '', query), fuzzyScore(item.subtitle || '', query) / 2);
  }

  function rankPalette(query) {
    if (!query) {
      return SECTION_ORDER.flatMap((section) => {
        const inSection = palette.items.filter((item) => item.section === section);
        return section === 'Recent' ? inSection.slice(0, 6) : inSection;
      });
    }
    const scored = palette.items
      .map((item) => ({ item, score: matchScore(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    // Sections follow the order of their best match.
    const groups = new Map();
    for (const { item } of scored) {
      if (!groups.has(item.section)) groups.set(item.section, []);
      groups.get(item.section).push(item);
    }
    const matches = [...groups.values()].flat().slice(0, 60);
    const search = { section: 'Search', title: `Search Kaggle for “${query}”`, icon: 'search', url: `/search?q=${encodeURIComponent(query)}` };
    // A strong match wins Enter; otherwise searching Kaggle does.
    return scored[0]?.score >= 500 ? [...matches, search] : [search, ...matches];
  }

  function appendHighlighted(node, text, query) {
    const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (at < 0) {
      node.textContent = text;
      return;
    }
    node.append(text.slice(0, at), el('mark', '', {}, text.slice(at, at + query.length)), text.slice(at + query.length));
  }

  function paletteRow(item, index, query) {
    const row = el('div', 'item', { role: 'option', 'data-index': String(index) });
    const title = el('span', 'title');
    appendHighlighted(title, item.title, query);
    row.append(el('span', 'icon', {}, item.icon || 'arrow_forward'), title);
    if (item.subtitle) row.append(el('span', 'sub', {}, item.subtitle));
    if (item.keys) {
      const keys = el('span', 'keys');
      for (const key of item.keys) keys.append(el('kbd', '', {}, key));
      row.append(keys);
    }
    return row;
  }

  function renderPalette() {
    const query = palette.input.value.trim();
    palette.results = rankPalette(query);
    palette.active = Math.min(palette.active, Math.max(0, palette.results.length - 1));
    const fragment = document.createDocumentFragment();
    let section = null;
    palette.results.forEach((item, index) => {
      if (item.section !== section) {
        section = item.section;
        fragment.append(el('div', 'section', {}, section));
      }
      fragment.append(paletteRow(item, index, query));
    });
    palette.list.replaceChildren(fragment);
    setActive(palette.active);
  }

  function setActive(index) {
    palette.active = index;
    for (const row of palette.list.querySelectorAll('.item')) {
      const active = Number(row.dataset.index) === index;
      row.classList.toggle('active', active);
      if (active) row.scrollIntoView({ block: 'nearest' });
    }
  }

  function runItem(item, newTab = false) {
    closePalette();
    if (item.url) navigate(item.url, newTab);
    else item.run?.();
  }

  function onPaletteKey(event) {
    const count = palette.results.length;
    if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n')) {
      event.preventDefault();
      if (count) setActive((palette.active + 1) % count);
    } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p')) {
      event.preventDefault();
      if (count) setActive((palette.active - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = palette.results[palette.active];
      if (item) runItem(item, event.metaKey || event.ctrlKey);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
    // Keep Kaggle's own key handlers out of the palette.
    event.stopPropagation();
  }

  function buildPalette() {
    const overlay = el('div', 'overlay');
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="search">
          <span class="icon">search</span>
          <input type="text" placeholder="Search Kaggle or jump to…" spellcheck="false" autocomplete="off" aria-label="Command">
          <kbd>esc</kbd>
        </div>
        <div class="results" role="listbox"></div>
        <div class="footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>${MOD}</kbd><kbd>↵</kbd> new tab</span>
          <span class="brand">Kaggle Rework</span>
        </div>
      </div>`;
    ui().root.append(overlay);
    palette.overlay = overlay;
    palette.input = overlay.querySelector('input');
    palette.list = overlay.querySelector('.results');
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) closePalette();
    });
    palette.input.addEventListener('input', () => {
      palette.active = 0;
      renderPalette();
    });
    palette.input.addEventListener('keydown', onPaletteKey);
    palette.list.addEventListener('mousemove', (event) => {
      const row = event.target.closest('.item');
      if (row && Number(row.dataset.index) !== palette.active) setActive(Number(row.dataset.index));
    });
    palette.list.addEventListener('click', (event) => {
      const row = event.target.closest('.item');
      if (row) runItem(palette.results[Number(row.dataset.index)], event.metaKey || event.ctrlKey);
    });
  }

  function openPalette() {
    if (!settings.commandPalette) return;
    if (!palette.overlay) buildPalette();
    closeDialogs();
    palette.returnFocus = document.activeElement;
    palette.items = paletteItems();
    palette.input.value = '';
    palette.active = 0;
    renderPalette();
    palette.overlay.classList.add('open');
    palette.input.focus();
  }

  function closePalette() {
    if (!palette.overlay?.classList.contains('open')) return;
    palette.overlay.classList.remove('open');
    palette.returnFocus?.focus?.();
  }

  function togglePalette() {
    if (palette.overlay?.classList.contains('open')) closePalette();
    else openPalette();
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  let goPressedAt = 0;

  function isTyping(event) {
    const target = event.composedPath()[0];
    if (!(target instanceof Element)) return false;
    return target.isContentEditable
      || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      || Boolean(target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor, .cm-editor, .CodeMirror'));
  }

  // Code and rich text editors use ⌘K themselves (Kaggle's comment editor inserts links with it).
  function inTextEditor(event) {
    const target = event.composedPath()[0];
    if (isEditorPage()) return true;
    if (!(target instanceof Element)) return false;
    return target.tagName === 'TEXTAREA'
      || target.isContentEditable
      || Boolean(target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor, .cm-editor, .CodeMirror'));
  }

  function switchTab(step) {
    const tabs = pageTabs();
    const current = tabs.findIndex((tab) => tab.selected);
    const next = tabs[current + step];
    if (current < 0 || !next) return false;
    next.element.click();
    return true;
  }

  // Shortcuts use physical keys (event.code), so they work with any keyboard layout.
  // Some virtual and remote keyboards leave event.code empty; fall back to the key then.
  function keyCode(event) {
    if (event.code) return event.code;
    const key = event.key || '';
    if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
    return { '/': 'Slash', '?': 'Slash', '[': 'BracketLeft', ']': 'BracketRight' }[key] || '';
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    const code = keyCode(event);
    const mod = IS_MAC ? event.metaKey : event.ctrlKey;
    if (mod && !event.altKey && !event.shiftKey && code === 'KeyK') {
      if (!settings.commandPalette || inTextEditor(event)) return;
      event.preventDefault();
      event.stopPropagation();
      togglePalette();
      return;
    }
    if (event.key === 'Escape' && anyOverlayOpen()) {
      closePalette();
      closeDialogs();
      return;
    }
    if (!settings.shortcuts || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event) || anyOverlayOpen() || kaggleDialogOpen() || isEditorPage()) return;

    const letter = /^Key[A-Z]$/.test(code) && !event.shiftKey ? code.slice(3).toLowerCase() : '';
    if (goPressedAt && Date.now() - goPressedAt < 1500) {
      goPressedAt = 0;
      const target = letter && DESTINATIONS.find((candidate) => candidate.key === letter && (!candidate.auth || isSignedIn()));
      const url = target && destinationUrl(target);
      if (url) {
        event.preventDefault();
        navigate(url);
      }
      return;
    }
    if (letter === 'g') {
      goPressedAt = Date.now();
    } else if (code === 'Slash' && !event.shiftKey) {
      const input = searchInput();
      if (input) {
        event.preventDefault();
        input.focus();
      }
    } else if (code === 'Slash') {
      event.preventDefault();
      openHelp();
    } else if ((code === 'BracketLeft' || code === 'BracketRight') && !event.shiftKey && switchTab(code === 'BracketRight' ? 1 : -1)) {
      event.preventDefault();
    }
  }

  // ---------------------------------------------------------------------------
  // Theme switch
  // ---------------------------------------------------------------------------

  function themeState() {
    if (!isSignedIn()) return null;
    const context = themeContext();
    return context ? { context, dark: Boolean(context.darkModeEnabled), mode: context.theme } : null;
  }

  async function setThemeMode(mode) {
    const state = themeState();
    if (!state) return;
    try {
      await state.context.updateTheme(mode);
      toast(mode === 'device' ? 'Following the system theme' : `${mode === 'dark' ? 'Dark' : 'Light'} theme on`);
    } catch {
      toast('The theme changed, but Kaggle could not save it');
    }
    renderActions(true);
  }

  function toggleTheme() {
    const state = themeState();
    if (state) setThemeMode(state.dark ? 'light' : 'dark');
  }

  // ---------------------------------------------------------------------------
  // Top bar actions
  // ---------------------------------------------------------------------------

  function createActionsHost() {
    const { host, root } = createHost('kaggle-rework-actions', ACTIONS_CSS, `
      <button type="button" class="jump" data-action="palette" aria-label="Open the command palette" title="Command palette (${MOD} K)">
        <span class="icon">search</span><span class="label">Jump to</span><kbd>${MOD}</kbd><kbd>K</kbd>
      </button>
      <button type="button" class="round" data-action="theme"><span class="icon">dark_mode</span></button>
      <button type="button" class="round" data-action="settings" aria-label="Kaggle Rework settings" title="Kaggle Rework settings">
        <span class="icon">tune</span>
      </button>`);
    root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'palette') openPalette();
      else if (action === 'theme') toggleTheme();
      else if (action === 'settings') openSettings();
    });
    return host;
  }

  function mountActions() {
    const bar = document.querySelector(TOP_BAR_SURFACE);
    const slot = bar?.lastElementChild;
    if (!slot || slot.localName === 'kaggle-rework-actions') return;
    const host = document.querySelector('kaggle-rework-actions') || createActionsHost();
    // The account area (sign-in links or avatar) is a flex row that Kaggle pins to the right
    // edge on very wide screens; joining it keeps the buttons next to it everywhere.
    const row = [...slot.children].find((child) => child !== host);
    const inRow = Boolean(row) && getComputedStyle(row).display.includes('flex');
    if (inRow) {
      if (row.firstElementChild !== host) row.prepend(host);
    } else if (host.parentElement !== bar || host.nextElementSibling !== slot) {
      bar.insertBefore(host, slot);
    }
    host.toggleAttribute('data-in-row', inRow);
    renderActions();
  }

  function renderActions(force = false) {
    const host = document.querySelector('kaggle-rework-actions');
    if (!host) return;
    const theme = settings.themeSwitch ? themeState() : null;
    const state = `${settings.commandPalette}|${theme ? theme.dark : 'none'}`;
    if (!force && host.dataset.state === state) return;
    host.dataset.state = state;
    const root = host.shadowRoot;
    root.querySelector('.jump').hidden = !settings.commandPalette;
    const themeButton = root.querySelector('[data-action="theme"]');
    themeButton.hidden = !theme;
    if (theme) {
      const label = theme.dark ? 'Switch to light theme' : 'Switch to dark theme';
      themeButton.title = label;
      themeButton.setAttribute('aria-label', label);
      themeButton.querySelector('.icon').textContent = theme.dark ? 'light_mode' : 'dark_mode';
    }
  }

  // ---------------------------------------------------------------------------
  // Live competition deadlines
  // ---------------------------------------------------------------------------

  const MILESTONES = [
    ['prohibitNewEntrantsExplicitDeadline', 'Entry deadline'],
    ['teamMergerExplicitDeadline', 'Team merger deadline'],
    ['deadline', 'Final submission deadline'],
  ];
  const FINAL = 'Final submission deadline';
  const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  });
  const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let countdownTimer = 0;

  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const time = [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
    return days ? `${days}d ${time}` : time;
  }

  function relativeTime(date, now) {
    const diff = date - now;
    const size = Math.abs(diff);
    if (size >= 864e5) return RELATIVE.format(Math.round(diff / 864e5), 'day');
    if (size >= 36e5) return RELATIVE.format(Math.round(diff / 36e5), 'hour');
    return RELATIVE.format(Math.round(diff / 6e4), 'minute');
  }

  // The competition object, with all its deadlines, is a prop of the page header.
  function competitionMilestones(anchor) {
    const competition = findInFibers(anchor, (fiber) => {
      const value = fiber.memoizedProps?.competition;
      return value && value.deadline instanceof Date ? value : null;
    }, 80);
    const milestones = [];
    for (const [key, label] of MILESTONES) {
      const date = competition?.[key];
      if (date instanceof Date && !Number.isNaN(date.getTime())) milestones.push({ label, date });
    }
    if (!milestones.some((milestone) => milestone.label === FINAL)) {
      const date = new Date(anchor.title);
      if (!Number.isNaN(date.getTime())) milestones.push({ label: FINAL, date });
    }
    return milestones.sort((a, b) => a.date - b.date);
  }

  function updateCountdown(host) {
    const root = host.shadowRoot;
    const now = Date.now();
    const final = host.milestones.find((milestone) => milestone.label === FINAL);
    const left = final.date - now;
    const pill = root.querySelector('.pill');
    root.querySelector('.time').textContent = left > 0 ? formatCountdown(left) : 'Closed';
    pill.classList.toggle('soon', left > 0 && left < 3 * 864e5);
    pill.classList.toggle('urgent', left > 0 && left < 864e5);
    pill.setAttribute('aria-label', left > 0 ? `Final submission deadline in ${formatCountdown(left)}` : 'Final submission deadline passed');
    root.querySelector('.list').replaceChildren(...host.milestones.map(({ label, date }) => {
      const row = el('div', date <= now ? 'milestone past' : 'milestone');
      row.append(el('span', 'dot'), el('span', 'label', {}, label), el('span', 'relative', {}, relativeTime(date, now)), el('span', 'when', {}, DATE_FORMAT.format(date)));
      return row;
    }));
  }

  function createCountdown() {
    const { host, root } = createHost('kaggle-rework-countdown', COUNTDOWN_CSS, `
      <button type="button" class="pill"><span class="icon">timer</span><span class="time"></span></button>
      <div class="pop" role="tooltip"><div class="heading">Deadlines in your time zone</div><div class="list"></div></div>`);
    root.querySelector('.pill').addEventListener('click', () => host.classList.toggle('open'));
    return host;
  }

  function mountCountdown() {
    let host = document.querySelector('kaggle-rework-countdown');
    const anchor = settings.deadlines && /^\/competitions\/[^/]+/.test(location.pathname)
      ? document.querySelector('#site-content span[aria-label$=" to go"][title]')
      : null;
    if (!anchor) {
      host?.remove();
      return;
    }
    // React may reuse the header when moving between competitions, so check which one it is.
    const slug = location.pathname.split('/')[2];
    if (host && host.previousSibling === anchor && host.dataset.slug === slug) return;
    const milestones = competitionMilestones(anchor);
    const final = milestones.find((milestone) => milestone.label === FINAL);
    if (!final || final.date - Date.now() > 400 * 864e5) {
      host?.remove();
      return;
    }
    host = host || createCountdown();
    host.milestones = milestones;
    host.dataset.slug = slug;
    anchor.after(host);
    updateCountdown(host);
    if (!countdownTimer) {
      countdownTimer = setInterval(() => {
        const current = document.querySelector('kaggle-rework-countdown');
        if (!current) {
          clearInterval(countdownTimer);
          countdownTimer = 0;
        } else if (!document.hidden) {
          updateCountdown(current);
        }
      }, 1000);
    }
  }

  function closeCountdownOnOutsideClick(event) {
    const host = document.querySelector('kaggle-rework-countdown.open');
    if (host && !event.composedPath().includes(host)) host.classList.remove('open');
  }

  // ---------------------------------------------------------------------------
  // Reading progress and back to top
  // ---------------------------------------------------------------------------

  let boundScroller = null;
  let scrollFrame = 0;

  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      updateScrollUi();
    });
  }

  function bindScroller() {
    const element = scroller();
    if (element === boundScroller) return;
    boundScroller?.removeEventListener('scroll', onScroll);
    boundScroller = element;
    element?.addEventListener('scroll', onScroll, { passive: true });
  }

  // Floating buttons stay clear of bars Kaggle pins to the bottom edge (like the cookie notice).
  function updateBottomInset() {
    if (!uiParts) return;
    let inset = 0;
    for (const child of scroller()?.children || []) {
      if (getComputedStyle(child).position !== 'fixed') continue;
      const rect = child.getBoundingClientRect();
      if (rect.height > 0 && rect.height < 200 && Math.abs(rect.bottom - window.innerHeight) < 2) inset = Math.max(inset, rect.height);
    }
    uiParts.root.host.style.setProperty('--kr-bottom-inset', `${Math.round(inset)}px`);
  }

  function updateScrollUi() {
    const element = boundScroller;
    if (!element || !uiParts) return;
    const top = element.scrollTop;
    const range = element.scrollHeight - element.clientHeight;
    document.documentElement.classList.toggle('kr-scrolled', top > 2);
    const progress = settings.readingProgress && isArticlePage() && range > element.clientHeight * 0.75;
    uiParts.progress.classList.toggle('on', progress);
    if (progress) uiParts.progress.style.transform = `scaleX(${Math.min(1, Math.max(0, top / range))})`;
    uiParts.top.classList.toggle('show', settings.backToTop && !isEditorPage() && top > element.clientHeight * 1.5);
  }

  // ---------------------------------------------------------------------------
  // Notebooks: the iframe asks for its settings once it has loaded
  // ---------------------------------------------------------------------------

  function postNotebookConfig(target) {
    const message = { type: 'kaggle-rework:notebook-config', enabled: settings.notebooks };
    if (target) {
      target.postMessage(message, NOTEBOOK_ORIGIN);
      return;
    }
    for (const frame of document.querySelectorAll(`iframe[src^="${NOTEBOOK_ORIGIN}/"]`)) {
      frame.contentWindow?.postMessage(message, NOTEBOOK_ORIGIN);
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  let tickQueued = false;
  let watchedContent = null;
  const contentClassObserver = new MutationObserver(() => queueTick());

  function queueTick() {
    if (tickQueued) return;
    tickQueued = true;
    requestAnimationFrame(() => {
      tickQueued = false;
      tick();
    });
  }

  function tick() {
    const content = scroller();
    if (content && content !== watchedContent) {
      watchedContent = content;
      contentClassObserver.disconnect();
      contentClassObserver.observe(content, { attributes: true, attributeFilter: ['class'] });
    }
    syncTheme();
    bindScroller();
    mountActions();
    mountCountdown();
    updateBottomInset();
    updateScrollUi();
  }

  function onReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  installCssRewriter();
  watchHistory();

  const baseStyle = document.createElement('style');
  baseStyle.id = 'kaggle-rework';
  baseStyle.textContent = BASE_CSS;
  document.documentElement.append(baseStyle);
  applyDesignClasses();

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('click', closeCountdownOnOutsideClick, true);

  window.addEventListener('message', (event) => {
    if (event.origin === NOTEBOOK_ORIGIN && event.data?.type === 'kaggle-rework:notebook-ready') postNotebookConfig(event.source);
  });

  // Other tabs share the same settings.
  window.addEventListener('storage', (event) => {
    if (event.key !== SETTINGS_KEY) return;
    const next = loadSettings();
    for (const key of Object.keys(DEFAULTS)) {
      if (next[key] === settings[key]) continue;
      settings[key] = next[key];
      settingListeners.forEach((listener) => listener(key));
    }
  });

  settingListeners.add((key) => {
    applyDesignClasses();
    if (key === 'notebooks') postNotebookConfig();
    if (key === 'commandPalette' && !settings.commandPalette) closePalette();
    renderActions(true);
    mountCountdown();
    updateScrollUi();
  });

  routeListeners.add(() => {
    staleTitle = document.title;
    closePalette();
    queueTick();
  });

  onReady(() => {
    retrofitSheets();
    ui();
    new MutationObserver(queueTick).observe(document.body, { childList: true, subtree: true });
    watchTitle();
    tick();
  });

  // ---------------------------------------------------------------------------
  // Notebook iframe (www.kaggleusercontent.com)
  // ---------------------------------------------------------------------------

  function notebookFrame() {
    const PARENT_ORIGIN = 'https://www.kaggle.com';
    const STORE_KEY = 'kaggle-rework:notebooks';
    const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&family=Google+Sans+Flex:wght@100..1000&display=swap';
    const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/></svg>';
    const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const NOTEBOOK_CSS = `
html.kr-nb body {
  --nb-text: #1F1F1F;
  --nb-text-2: #3D3D3D;
  --nb-muted: #8A8A8A;
  --nb-border: #EBEBEB;
  --nb-border-strong: #D9D9D9;
  --nb-code-bg: #F8F8F8;
  --nb-inline-code: #F1F1F1;
  --nb-row-hover: #F8F8F8;
  --nb-accent: #FFC412;
  --nb-button: #FFFFFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
html.kr-nb body.viewer-iframe-dark-theme {
  --nb-text: #F1F1F1;
  --nb-text-2: #D9D9D9;
  --nb-muted: #909090;
  --nb-border: #2E2E2E;
  --nb-border-strong: #474747;
  --nb-code-bg: #1F1F1F;
  --nb-inline-code: #2E2E2E;
  --nb-row-hover: #262626;
  --nb-button: #262626;
}
html.kr-nb :is(body, #notebook, .text_cell_render, .rendered_html, .jp-RenderedMarkdown, table.dataframe),
html.kr-nb :is(.text_cell_render, .rendered_html, .jp-RenderedMarkdown) :not(pre, pre *, code, code *, kbd, samp, .MathJax, .MathJax *, .MathJax_Display *, mjx-container, mjx-container *, .fa, .google-symbols) {
  font-family: "Google Sans Flex", Inter, sans-serif;
}
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) { color: var(--nb-text-2); font-size: 15px; line-height: 1.7; }
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) :is(p, li) { color: var(--nb-text-2); font-size: 15px; line-height: 1.7; text-wrap-style: pretty; }
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) :is(h1, h2, h3, h4, h5, h6) {
  color: var(--nb-text);
  font-family: "Google Sans Flex", Inter, sans-serif;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-wrap-style: balance;
}
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) h1 { font-size: 30px; line-height: 1.2; }
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) h2 { font-size: 24px; line-height: 1.25; }
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) h3 { font-size: 19px; line-height: 1.3; }
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) a:not(.anchor-link) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--nb-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
html.kr-nb :is(.text_cell_render, .jp-RenderedMarkdown) :not(pre) > code {
  padding: .15em .4em;
  border: 0;
  border-radius: 6px;
  background: var(--nb-inline-code);
  font-family: "Google Sans Code", "Roboto Mono", monospace;
  font-size: .88em;
}
html.kr-nb :is(.input_area, .jp-InputArea-editor) {
  position: relative;
  border: 1px solid var(--nb-border) !important;
  border-radius: 14px !important;
  background: var(--nb-code-bg) !important;
}
html.kr-nb :is(.input_area, .jp-InputArea-editor) .highlight { background: transparent !important; }
html.kr-nb :is(.input_area, .jp-InputArea-editor, .output_area, .jp-OutputArea-output, .text_cell_render, .jp-RenderedMarkdown) pre {
  font-family: "Google Sans Code", "Roboto Mono", monospace !important;
  font-size: 13.5px !important;
  line-height: 1.6 !important;
}
html.kr-nb :is(.prompt, .jp-InputPrompt, .jp-OutputPrompt) {
  color: var(--nb-muted);
  font-family: "Google Sans Code", "Roboto Mono", monospace;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
html.kr-nb table.dataframe { border: 0; border-collapse: collapse; color: var(--nb-text-2); font-size: 13px; font-variant-numeric: tabular-nums; }
html.kr-nb table.dataframe :is(th, td) { padding: 6px 10px !important; border: 0 !important; border-bottom: 1px solid var(--nb-border) !important; }
html.kr-nb table.dataframe thead th { background: transparent !important; color: var(--nb-text); font-weight: 600; border-bottom-color: var(--nb-border-strong) !important; }
html.kr-nb table.dataframe tbody th { background: transparent !important; color: var(--nb-muted); font-weight: 500; }
html.kr-nb table.dataframe tbody tr:hover { background: var(--nb-row-hover); }
.kr-copy { display: none; }
html.kr-nb .kr-copy {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--nb-border);
  border-radius: 8px;
  background: var(--nb-button);
  color: var(--nb-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s ease, color .15s ease;
}
html.kr-nb :is(.input_area, .jp-InputArea-editor):hover .kr-copy, html.kr-nb .kr-copy:focus-visible, html.kr-nb .kr-copy.done { opacity: 1; }
html.kr-nb .kr-copy:hover { color: var(--nb-text); }
html.kr-nb .kr-copy:focus-visible { outline: 2px solid #4D94FF; outline-offset: 2px; }
html.kr-nb .kr-copy.done { color: #189629; }
html.kr-nb .kr-copy svg { width: 16px; height: 16px; }
`;

    let enabled = true;
    try {
      enabled = localStorage.getItem(STORE_KEY) !== 'off';
    } catch {}

    const style = document.createElement('style');
    style.textContent = NOTEBOOK_CSS;
    document.documentElement.append(style);
    document.documentElement.classList.toggle('kr-nb', enabled);

    // Kaggle sizes the iframe to the notebook whenever the DOM changes; nudge it once the
    // new fonts have reflowed the text.
    const reflow = () => {
      document.documentElement.dataset.krReflow = String(Date.now());
    };

    function loadFonts() {
      if (document.getElementById('kr-nb-fonts')) return;
      const link = document.createElement('link');
      link.id = 'kr-nb-fonts';
      link.rel = 'stylesheet';
      link.href = FONTS_URL;
      link.addEventListener('load', () => document.fonts?.ready.then(reflow));
      (document.head || document.documentElement).append(link);
      document.fonts?.addEventListener('loadingdone', reflow);
    }

    function copy(text) {
      const listener = (event) => {
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
      };
      document.addEventListener('copy', listener);
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } finally {
        document.removeEventListener('copy', listener);
      }
      if (!copied) navigator.clipboard?.writeText(text).catch(() => {});
    }

    function addCopyButtons() {
      for (const area of document.querySelectorAll('.input_area, .jp-InputArea-editor')) {
        if (area.querySelector(':scope > .kr-copy')) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kr-copy';
        button.title = 'Copy code';
        button.setAttribute('aria-label', 'Copy code');
        button.innerHTML = COPY_ICON;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const source = area.querySelector('pre') || area;
          copy(source.innerText.replace(/\n+$/, ''));
          button.classList.add('done');
          button.innerHTML = CHECK_ICON;
          button.title = 'Copied';
          clearTimeout(button.resetTimer);
          button.resetTimer = setTimeout(() => {
            button.classList.remove('done');
            button.innerHTML = COPY_ICON;
            button.title = 'Copy code';
          }, 1600);
        });
        area.append(button);
      }
    }

    function apply() {
      document.documentElement.classList.toggle('kr-nb', enabled);
      if (enabled) {
        loadFonts();
        addCopyButtons();
      }
      reflow();
    }

    window.addEventListener('message', (event) => {
      if (event.origin !== PARENT_ORIGIN || event.data?.type !== 'kaggle-rework:notebook-config') return;
      const next = Boolean(event.data.enabled);
      try {
        localStorage.setItem(STORE_KEY, next ? 'on' : 'off');
      } catch {}
      if (next === enabled) return;
      enabled = next;
      apply();
    });

    onReady(() => {
      apply();
      if (window.parent !== window) window.parent.postMessage({ type: 'kaggle-rework:notebook-ready' }, PARENT_ORIGIN);
    });
  }
})();
