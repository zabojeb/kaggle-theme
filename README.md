# kaggle-theme

[Tampermonkey](https://www.tampermonkey.net/) userscripts for Kaggle's redesign: keep the new design and make it better, or bring back the old look.

Opening an install link makes Tampermonkey offer to install the script. Updates are pulled from this repository automatically.

## Kaggle Rework

[install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-rework.user.js)

A more polished, modern take on the new design, plus features Kaggle doesn't have. Everything can be switched on and off live from its settings panel (the sliders icon in the top bar, or the command palette).

**Look and feel**

- **Readable text**: regular weight instead of the light one Kaggle uses for body text.
- **Modern surfaces**: soft layered shadows instead of the old Material ones, lighter borders, and a gentle lift on cards.
- **Glass top bar**: the top bar turns translucent and blurs the page scrolling behind it.
- **Visible focus**: clear blue focus rings instead of a barely visible grey.
- **Typography polish**: even-width numbers in tables and leaderboards, balanced headings, nicer text selection, slim scrollbars.
- **Content width**: default, wide or full width on large screens.
- **Density**: compact rows in lists and leaderboards.

**Features**

- **Command palette** (<kbd>⌘</kbd> <kbd>K</kbd> / <kbd>Ctrl</kbd> <kbd>K</kbd>): jump to any section, reopen recently viewed competitions, datasets, notebooks and discussions, switch tabs on the current page, search Kaggle, and run actions.
- **Keyboard shortcuts**: <kbd>G</kbd> then a letter to switch sections (<kbd>G</kbd> <kbd>C</kbd> for competitions, <kbd>G</kbd> <kbd>D</kbd> for datasets and so on), <kbd>/</kbd> to search, <kbd>[</kbd> and <kbd>]</kbd> to switch tabs, <kbd>?</kbd> for the full list. They use physical keys, so they work with any keyboard layout.
- **Theme switch**: a light and dark toggle in the top bar instead of digging through account settings. Needs a signed-in account.
- **Live deadlines**: a ticking countdown on competition pages, with the entry, team merger and final submission deadlines in your time zone.
- **Reading progress**: a thin progress bar on notebooks, discussions and writeups.
- **Back to top**: a button to jump back up on long pages.
- **Modern notebooks**: notebooks use the same Google Sans fonts as the rest of Kaggle, with rounded code blocks, copy buttons on code cells and clean tables.

### How it works

Kaggle's components are styled with styled-components and MUI, which inject their rules through `CSSStyleSheet.insertRule` with theme values baked in. The script rewrites a few of those values into CSS variables that fall back to the original, so a design tweak that is switched off changes nothing, and switching one on applies instantly. Features read what they need from Kaggle's own app state (router, theme, current user, competition deadlines) and live in their own shadow DOM, so their styles never mix with Kaggle's. Settings and recently viewed pages are stored in `localStorage` on kaggle.com.

Kaggle Rework is built for the new design, so don't run it together with Old Design. Old Profile Colors and Old Medals work fine alongside it.

## Bring back the old look

| Script | What it does | Install |
|---|---|---|
| **Kaggle Old Design** | Fully restores the old design: colors, fonts, navigation, profiles, medals. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-design.user.js) |
| **Kaggle Old Profile Colors** | Keeps the new design but restores the old profile colors: avatar rings, tier and medal icons, the profile header, and the activity heatmap. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-profile-colors.user.js) |
| **Kaggle Old Medals** | Keeps the new design but restores the old medals: medal icons across the site and the medal on competition certificates. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-medals.user.js) |

Old Design already includes everything the other two do, so use it on its own. Old Profile Colors and Old Medals can run together.

### How it works

The new design is switched on by a client-side feature flag, `Rebrand`, while the old code, both color palettes and the old artwork still ship with Kaggle. All colors and images are taken from there rather than recreated by eye.

- **Old Design** hides the `Rebrand` flag from Kaggle while the page loads: it patches reads of the flags cache in `localStorage` and the `GetClientFeatureFlags` response, so Kaggle renders the old version by itself. The cache itself always keeps the real flags, so turning the script off brings the new design back on the next page load. It keeps working as long as Kaggle keeps the old code behind the flag. Once that code is removed, the site will simply stay on the new design.
- **Old Profile Colors** recolors elements of the new design:

  | Tier | New color | Old color |
  |---|---|---|
  | Novice / Contributor | `#B3C8CE` | `#20BEFF` (Novice heatmap: `#1CCD76`) |
  | Expert | `#9191FF` | `#8148FD` |
  | Master | `#FF6A00` | `#FF5C19` |
  | Grandmaster | `#FFC412` | `#EBCC29` (heatmap: `#E5CF4A`) |

  Tier and medal icons are swapped back to the old files on kaggle.com. The profile header gets the old yellow and blue blobs, with the variant picked by `userId`, the same way Kaggle did it.
- **Old Medals** swaps medal icons back to the old files on kaggle.com and makes competition certificates load the old medal artwork.

All scripts need `@grant none`: they work with the page's own JavaScript (its `fetch`, styles and React state).

### Stuck on the old design after turning Old Design off?

Versions up to 1.0.1 saved the edited flags to `localStorage`, so the old design stayed after the script was turned off. Version 1.1.0 fixes this and repairs the cache automatically: update the script, open Kaggle once with it enabled, and turning it off will work from then on.

To get the new design back right away without the script, run this in the browser console on kaggle.com and reload the page:

```js
localStorage.removeItem('KAGGLE_FEATURE_FLAGS')
```
