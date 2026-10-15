# kaggle-theme

[Tampermonkey](https://www.tampermonkey.net/) userscripts that bring back Kaggle's pre-rebrand look.

| Script | What it does | Install |
|---|---|---|
| **Kaggle Old Design** | Fully restores the old design: colors, fonts, navigation, profiles, medals. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-design.user.js) |
| **Kaggle Old Profile Colors** | Keeps the new design but restores the old profile colors: avatar rings, tier and medal icons, the profile header, and the activity heatmap. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-profile-colors.user.js) |
| **Kaggle Old Medals** | Keeps the new design but restores the old medals: medal icons across the site and the medal on competition certificates. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-medals.user.js) |

Old Design already includes everything the other two do, so use it on its own. Old Profile Colors and Old Medals can run together.

Opening an install link makes Tampermonkey offer to install the script. Updates are pulled from this repository automatically.

## How it works

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

All scripts need `@grant none`: Old Design and Old Medals patch the page's `fetch`, and Old Profile Colors reads the tier and `userId` from the page's React props.

## Stuck on the old design after turning Old Design off?

Versions up to 1.0.1 saved the edited flags to `localStorage`, so the old design stayed after the script was turned off. Version 1.1.0 fixes this and repairs the cache automatically: update the script, open Kaggle once with it enabled, and turning it off will work from then on.

To get the new design back right away without the script, run this in the browser console on kaggle.com and reload the page:

```js
localStorage.removeItem('KAGGLE_FEATURE_FLAGS')
```
