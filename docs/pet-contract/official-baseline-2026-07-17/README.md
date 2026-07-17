# Official Pet Baseline Record

Status: reference-not-observed

This record separates public Pet format guidance from the ChatGPT Desktop
`hatch-pet` contract. It is not an installer contract and must not be passed to
`create-pet.mjs` without an observed Desktop contract.

## Confirmed public guidance

The official Pets documentation states that a web-uploaded custom sprite sheet
must be a transparent PNG or WebP, exactly 1536 x 1872 pixels, and no larger
than 20 MiB. The same dimensions are compatible with the MVP default of an
8 x 9 atlas with 192 x 208 frames.

The official desktop flow is:

1. Open Settings > Pets.
2. Select Create your own pet.
3. Let the bundled `hatch-pet` workflow finish.
4. Return to Settings > Pets, select Refresh, and choose the new Pet.
5. Use `/pet` to wake the selected Pet.

The documentation does not publish a stable desktop manifest schema, row
mapping, file watcher, or programmatic Pet-selection API.

## Local observation

On 2026-07-17, ChatGPT Desktop 26.715.21316 on macOS was inspected. The
current Renderer did not expose a Pets page, a `hatch-pet` package, or a
programmatic selection surface. The local `~/.codex/pets` directory was empty.
Therefore the Desktop contract remains provisional and native Refresh,
selection, and `/pet` end-to-end verification are still open P0 work.

## Engineering consequence

`codex-skin-studio` may assemble and install a provisional local Pet only when
the caller explicitly opts in with `--allow-provisional`. The paired switcher
may apply the theme and install the Pet, but it must return
`theme-applied-pet-refresh-required` or
`theme-scheduled-pet-refresh-required`; it must not report a native Pet as
selected or running without application evidence.

Source: https://learn.chatgpt.com/docs/pets?surface=app
