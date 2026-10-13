# SipAware branding and installation icons

The Home hero now uses the full transparent SipAware logo as an accessible Home
link. Its image scales proportionally to 240px on small screens and 320px on
desktop, with a narrower maximum if the available space requires it. Ordinary
clicks and keyboard activation use the existing application navigation;
modified clicks retain native browser behavior.

## Assets

All assets are in `frontend/public/branding/`.

| File | Size | Use |
| --- | --- | --- |
| `sipaware-logo.png` | 1400 × 414 | Full transparent hero logo |
| `favicon.ico` | 16, 32, 48 | Browser favicon, three PNG frames |
| `favicon-16x16.png` | 16 × 16 | Transparent small favicon |
| `favicon-32x32.png` | 32 × 32 | Transparent favicon |
| `apple-touch-icon.png` | 180 × 180 | Opaque white iOS icon |
| `pwa-192x192.png` | 192 × 192 | Opaque white installation icon |
| `pwa-512x512.png` | 512 × 512 | Opaque white installation icon |
| `pwa-maskable-512x512.png` | 512 × 512 | Android adaptive icon |

The square icons contain the glass, liquid, leaf and yellow rays from the logo,
without the wordmark. The maskable artwork fits inside the central circle with
radius 40% of the image width; the background fills the entire square.

Source: the original user-supplied `da4f525e3d8fdf57677021b281a8d1be.png`,
SHA-256 `bae596b1d5249fba5187ec55f57204e555db7fa64e5ed36f2a8fab062fb4077a`.
The previous sandbox ZIP and preview were unavailable in this workspace. The
built-in ImageGen tool prepared transparency from the supplied raster, followed
by symbol cropping and deterministic resizing. The resulting artwork and its
rendering were visually inspected.

Transparency prompt:

> Use case: background-extraction. Edit target: the supplied original SipAware
> brand logo. Remove only its white/off-white background and produce true alpha
> transparency, including empty areas inside and around the glass and leaf.
> Preserve the exact original navy SipAware lettering, letter shapes, spelling,
> glass outline, blue liquid gradient, teal leaf and three yellow light rays; do
> not redraw, redesign, recolor or add elements. Retain the full horizontal logo
> with glass/leaf/rays left and SipAware text right. Crop excess blank margins to
> a modest transparent border. This is a production brand asset; the original
> design and relative proportions must be preserved.

## Installation and routing

HTML icon and manifest links use Vite's `%BASE_URL%`. The logo uses
`import.meta.env.BASE_URL`. Built links therefore resolve under `/iteration3/`.
Manifest icon URLs resolve relative to the manifest. Both manifest names and the
Apple home-screen title are `SipAware`.

The existing manifest `id: "./"`, `scope: "./"`, `start_url: "./record"` and
`display: "standalone"` are preserved. Installed launches still resolve to
`/iteration3/record`. The push-only `reminder-sw.js`, its notification destination,
the existing reminder icon file and the reminder registration code are unchanged.

Reference guidance: [Apple home-screen icons and title](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html),
[manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).

## Verification — 13 October 2026

Starting commit on main: `b88c0cd08a4bbb587ed3adc93cda86692f866520`.

| Check | Result |
| --- | --- |
| `npm ci` | Passed; lockfile unchanged; 0 reported vulnerabilities |
| `npm run build` | Passed |
| `npm run lint` | 0 errors; one existing `rememberSnapshot` dependency warning in `useAwardsNavigation.ts` |
| Branding and App navigation tests | 8 passed |
| Reminder worker, scheduler and access boundary tests | 15 passed |
| Unmodified main frontend baseline | 417 passed, 86 failed, 503 total |
| Final frontend suite | 422 passed, 85 failed, 507 total; no new failing test identities |
| Browser layout | Passed in installed Edge/Chromium at 320, 390, 768 and 1440px |
| Home navigation | Keyboard Enter, native destination and modified-click behavior verified |
| Asset delivery | Manifest, favicon and Apple links use `/iteration3/`; PNG dimensions and ICO frames checked |
| Browser manifest | Chromium parsed it with zero manifest errors |
| Maskable safe area | 0 colored pixels outside the safe circle |

The first HomePage test was updated for the requested linked logo and the five
feature links already present on main. The remaining 85 failures reproduce main
baseline failures across older drinks, history, awards and reminder UI/storage
expectations. Two HomePage tests still expect the removed reminder dialog.
These unrelated behaviors were not changed for this branding update.

WebKit was unavailable on this machine. The checks above establish Chromium
rendering and installation metadata, not actual iOS Safari or Android Chrome
home-screen installation. Those device checks remain outstanding. After the
branch is deployed over HTTPS, add `/iteration3/` to each device's home screen,
confirm the SipAware title and symbol, launch the icon, and verify the Record
entry. Existing installed icons may require removal and re-addition to refresh
OS-cached artwork; user records remain in the browser's existing local storage.
