# Powershot Chrome Extension

Manifest V3 capture tray for Powershot.

Build:

```bash
pnpm --dir extension install
pnpm --dir extension build
```

Load `extension/dist` as an unpacked extension in Chrome.

## How it works

Each capture (visible tab or region) is appended to a tray held in
`chrome.storage.local`. The popup shows the stack of thumbnails; clicking
**Send N to Powershot** opens (or focuses) `https://powershot.org/new` and
delivers all images in a single `POWERSHOT_CAPTURE` message.

## Shortcuts

- `Alt+Shift+S` — capture the visible tab into the tray
- `Alt+Shift+R` — pick a region into the tray

## Limits

- Soft cap: 30 items per tray (oldest are evicted past the cap).
- Storage uses the `unlimitedStorage` permission so full-quality PNGs are
  preserved for OCR fidelity.

Before Chrome Web Store submission, replace the placeholder icons in
`extension/public/icons/` with final branded assets and add store screenshots.
