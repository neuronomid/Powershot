# Powershot Chrome Extension

Manifest V3 scaffold for Phase 12.

Build:

```bash
pnpm --dir extension install
pnpm --dir extension build
```

Load `extension/dist` as an unpacked extension in Chrome.

Current scope:

- Visible-tab capture
- Region selection capture
- `Alt+Shift+S` keyboard shortcut for visible-tab capture
- `postMessage` handoff into `https://powershot.org/new?source=extension`

Before Chrome Web Store submission, replace the placeholder icons in
`extension/public/icons/` with final branded assets and add store screenshots.
