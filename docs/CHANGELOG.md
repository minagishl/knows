# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-10-26

### Added

- Released the cross-platform `knows` CLI for discovering, inspecting, and terminating listening processes on macOS, Linux, and Windows.
- Implemented core commands: `list` for enumerating listeners, `inspect` for drilling into a specific port, `kill` (with optional `--force`) for terminating processes, and `interactive` for guided selection via prompts.
- Added process enrichment that surfaces command details alongside port, protocol, PID, and address information.
- Documented installation, usage examples, and screenshots in `README.md`, plus supplied MIT license text and community issue template.
- Introduced project tooling and automation including Prettier formatting, `.editorconfig`, and a GitHub publish workflow.

[1.0.0]: https://www.npmjs.com/package/knows/v/1.0.0
