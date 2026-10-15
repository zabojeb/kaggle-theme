# kaggle-theme

[Tampermonkey](https://www.tampermonkey.net/) userscripts that bring back Kaggle's pre-rebrand look. Install one of them, not both.

| Script | What it does | Install |
|---|---|---|
| **Kaggle Old Profile Colors** | Keeps the new design but restores the old profile colors: avatar rings, tier and medal icons, the profile header, and the activity heatmap. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-profile-colors.user.js) |
| **Kaggle Old Design** | Fully restores the old design: colors, fonts, navigation, profiles. | [install](https://raw.githubusercontent.com/zabojeb/kaggle-theme/main/kaggle-old-design.user.js) |

Opening an install link makes Tampermonkey offer to install the script. Updates are pulled from this repository automatically.

## How it works

The new design is switched on by a client-side feature flag, `Rebrand`, while the old code and both color palettes still ship in Kaggle's bundle. All colors are taken from there rather than picked by eye.

- **Old Design** strips the `Rebrand` flag from the flags cache in `localStorage` and from the `GetClientFeatureFlags` response, so Kaggle renders the old version by itself. It keeps working as long as Kaggle keeps the old code behind the flag. Once that code is removed, the site will simply stay on the new design.
- **Old Profile Colors** recolors elements of the new design:

  | Tier | New color | Old color |
  |---|---|---|
  | Novice / Contributor | `#B3C8CE` | `#20BEFF` (Novice heatmap: `#1CCD76`) |
  | Expert | `#9191FF` | `#8148FD` |
  | Master | `#FF6A00` | `#FF5C19` |
  | Grandmaster | `#FFC412` | `#EBCC29` (heatmap: `#E5CF4A`) |

  Tier and medal icons are swapped back to the old files on kaggle.com. The profile header gets the old yellow and blue blobs, with the variant picked by `userId`, the same way Kaggle did it.

The colors script needs `@grant none`: it reads the tier and `userId` from the page's React props.
