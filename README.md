# Haelō 3D Viewer Demo

This repo is a small Vite + React demo app for quickly trying Exocor in a 3D workflow.

It gives you a realistic surface for testing the SDK inside a product-like experience: loading a 3D object, inspecting it in a viewer, adjusting the scene, and seeing how Exocor fits into that UI.

## What This Demo Is For

- Trying Exocor quickly without setting up a larger app
- Evaluating how the SDK feels in a spatial or 3D product experience
- Sharing a simple, runnable example with other developers

This is a demo app, not a production starter.

## Quick Start

1. Copy `.env.example` to `.env`
2. Add your own Anthropic API key to `ANTHROPIC_API_KEY`
3. Install dependencies with `npm install`
4. In one terminal, start the local Exocor relay with `npx exocor dev`
5. In a second terminal, start the app with `npm run dev`
6. Open the local Vite URL shown in the terminal

The relay is required for localhost testing. It reads `ANTHROPIC_API_KEY` from the demo root and keeps that key out of the browser.

## Local Testing Flow

From the demo root:

```bash
# terminal 1
npx exocor dev
```

```bash
# terminal 2
npm run dev
```

Run `npx exocor dev` from this repo root so Exocor can read `.env` or `.env.local`.

## Environment Variables

- `ANTHROPIC_API_KEY`: your Anthropic API key for the Exocor-powered experience; the local relay reads this from `.env` or `.env.local`
- `VITE_EXOCOR_DEBUG`: optional debug flag for local SDK debugging

## Scripts

- `npm run dev`: start the local development server
- `npm run build`: create a production build
- `npm run preview`: preview the production build locally
- `npx exocor dev`: start the local Exocor relay used for localhost testing

## License

MIT. See [`LICENSE`](./LICENSE).
