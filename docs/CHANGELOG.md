# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-10-27

### Added

- Introduced a real-time `watch` command for monitoring ports, with support for `--port`, `--port-range`, and `--interval` tuning.
- Added `--port-range` filtering to the `list` command so you can target inclusive port ranges without scripting.
- Added `--format` to `list` and `inspect`, enabling structured `text`, `json`, or `csv` output on demand.
- Added `--output` to `list` and `inspect` to save results directly to disk.
- Added a `pnpm typecheck` script for quick no-emit TypeScript validation.

### Changed

- The `kill` command now previews matching processes and asks for confirmation before terminating them; pass `--force` to skip the prompt and proceed immediately.
- Replaced the TypeScript compiler build step with an esbuild-powered bundle via `scripts/build.mjs`, producing an optimized `dist/index.js`.

### CI

- Introduced a `Checks` workflow that runs `pnpm install` and `pnpm run typecheck` on pushes and pull requests.
- Added a scheduled and on-push CodeQL analysis workflow for JavaScript/TypeScript.
- Updated the checks workflow to initialize pnpm after Node setup and pin version 10 for consistency.

## [1.0.1] - 2025-10-26

### Changed

- Filled in npm package metadata (author, repository, homepage, bugs URL) so consumers see the correct project links.

### Fixed

- Updated the publish workflow to run `pnpm install` after removing a typo in the `--frozen-lockfile` flag that broke automated releases.

## [1.0.0] - 2025-10-26

### Added

- Released the cross-platform `knows` CLI for discovering, inspecting, and terminating listening processes on macOS, Linux, and Windows.
- Implemented core commands: `list` for enumerating listeners, `inspect` for drilling into a specific port, `kill` (with optional `--force`) for terminating processes, and `interactive` for guided selection via prompts.
- Added process enrichment that surfaces command details alongside port, protocol, PID, and address information.
- Documented installation, usage examples, and screenshots in `README.md`, plus supplied MIT license text and community issue template.
- Introduced project tooling and automation including Prettier formatting, `.editorconfig`, and a GitHub publish workflow.

[1.1.0]: https://www.npmjs.com/package/knows/v/1.1.0
[1.0.1]: https://www.npmjs.com/package/knows/v/1.0.1
[1.0.0]: https://www.npmjs.com/package/knows/v/1.0.0
