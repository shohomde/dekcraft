# Dekcraft

Your curiosity. Your feed. Your call.

A free, local-first YouTube recommendation filter, companion playground, and public website.

- **Website:** https://shohomde.github.io/dekcraft/
- **Playground:** https://shohomde.github.io/dekcraft/playground/
- **Privacy:** https://shohomde.github.io/dekcraft/privacy/

## Features

- Set your interests and avoided topics in your own words.
- Match related titles with a bundled, quantized all-MiniLM-L6-v2 model; no external inference API.
- Check, review and block recommendations manually, or enable continuous auto-filtering.
- Toggle “Only my interests” on and off; the second click restores previous settings.
- Hide the floating widget while filtering continues; the extension icon restores it.
- Export/import preferences, adjust discovery and review hidden cards.

The website playground uses sample recommendations. Install the extension to filter YouTube Home and Watch-page recommendations. English titles work best; semantic matching is approximate. It does not change YouTube’s recommendation algorithm or filter mobile apps. YouTube layouts vary; test the extension in your own browser. No Chrome Web Store submission has been made.

## Install

1. Download the extension from the website and unzip it.
2. In Chrome, Edge or Arc, open the Extensions page and enable Developer mode.
3. Choose **Load unpacked**, select `dekcraft-extension`, and refresh YouTube.
4. Open Dekcraft Settings and choose your interests. Enable auto-filtering when desired.

## Develop

Requires Node 22.13+ (Node 24 recommended), npm, curl and zip.

```sh
npm ci
npm run prepare:semantic
npm test
npm run typecheck
npm run build
npm run dev
```

The preview is at `http://127.0.0.1:5173/dekcraft/`. Run `npm run build` again after changes. `npm test` builds the extension before running the regression suite. `npm run test:semantic` additionally exercises the real local model.

`prepare:semantic` downloads pinned, checksum-verified model files and copies the installed WASM runtime. Generated model files, bundles, extension ZIPs and dependencies are not committed. The static build is written to `dist/`; the extension folder to `release/dekcraft-extension/`.

## GitHub Pages

In **Settings → Pages → Build and deployment**, select **GitHub Actions**. The included workflow installs dependencies, prepares the model, runs tests and type checks, builds the static website and extension download, and publishes `dist/` on pushes to `main`. All internal asset links support the `/dekcraft/` project path. No hosting credentials or API keys are needed.

## Source map

- `site/`: landing page, privacy page and playground entry
- `app/`, `components/`, `hooks/`: companion playground and extension options
- `lib/`: matching, semantic queues, preference normalization and page checks
- `extension/`: YouTube adapters, toolbar, background and model worker
- `tests/`: rule, interaction and semantic model tests
- `scripts/`: asset preparation and portable build tools

Dekcraft evolved from FeedPilot. Internal preference keys and DOM identifiers retain that name for compatibility. The private Sites hosting integration and hosting identity are excluded from this repository.

## Privacy and license

Matching runs locally. No analytics or remote inference are included. See the [privacy page](https://shohomde.github.io/dekcraft/privacy/), [MIT license](LICENSE), and [third-party notices](THIRD_PARTY_NOTICES.txt). Model and font notices are included with the extension.
