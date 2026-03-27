# Haelō 3D Viewer Demo

A 3D model viewer demo for trying [Exocor](https://github.com/haelo-labs/exocor) in a spatial product workflow.

This app gives you a realistic surface for testing Exocor inside a product-like 3D experience: load a model, inspect it in the viewport, adjust its materials, and switch transform modes without leaving the app.

## What You Can Try

- Load a local 3D model into the viewer
- Select and deselect the loaded model
- Zoom the viewport camera in and out
- Switch between translate and scale modes
- Apply steel, copper, and carbon material presets
- Adjust metalness and roughness on the loaded model
- Compare Exocor's learned UI model with the app-native viewer tools exposed through `SpatialProvider`

This is a demo app, not a production starter.

## Quick Start

1. Copy `.env.example` to `.env`
2. Add your Anthropic API key to `ANTHROPIC_API_KEY`
3. Install dependencies with `npm install`
4. In one terminal, run `npx exocor dev`
5. In a second terminal, run `npm run dev`
6. Open the local Vite URL shown in the terminal
7. Load a supported 3D file into the viewer to try the material and transform workflows

Run `npx exocor dev` from this repo root so the local relay can read `.env` or `.env.local`.

## Exocor Version

This repo is pinned to `exocor@0.2.1`.

The demo uses the published package by default so the GitHub repo is clone-and-run friendly.

## App-Native Tools

This demo registers app-native tools for the viewer workflows it already supports today.

- Select or deselect the loaded model
- Zoom the viewport camera in or out
- Switch between translate and scale modes
- Apply a material preset
- Set metalness
- Set roughness

Model import still happens through the existing local file workflow. Once a model is loaded, Exocor can use the registered viewer actions instead of relying only on learned structure and DOM fallback.

## Supported File Types

- `.glb`
- `.gltf`
- `.stl`
- `.obj`
- `.fbx`
- `.ply`

## Environment Variables

- `ANTHROPIC_API_KEY`: used by the local Exocor relay from `.env` or `.env.local`
- `VITE_EXOCOR_DEBUG`: optional debug flag for local SDK debugging

## Scripts

- `npm run dev`: start the local development server
- `npm run build`: create a production build
- `npm run preview`: preview the production build locally
- `npx exocor dev`: start the local Exocor relay for localhost testing

## License

MIT. See [`LICENSE`](./LICENSE).
