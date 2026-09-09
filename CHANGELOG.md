# Changelog

## 2.1.0-beta1

### Added

- **Built-in RCS2/Companion Gateway.** Midra units only accept one direct TCP connection at a time, which previously meant running Analog Way's separate AW Gateway app if you wanted RCS2 and Companion connected at the same time. Enable "Enable local Gateway" in the connection settings and Companion holds the connection to the unit itself, opening a local TCP port (default 10500, the unit's own port) that RCS2 or other Midra clients can connect to instead of the unit directly - their commands get relayed to the unit, and everything the unit sends back gets mirrored to all connected clients.
- **"Memory active" feedback**, highlighting a button when a given screen memory is currently loaded into Program/Preview. Tracked the same way as in the LiveCore module: `PIpid` reports which memory is loaded into each preset buffer, `SPCtb`/`GCtba` reports which buffer is currently live in program.

### Fixed

- **Incoming data from the unit could be parsed incorrectly.** `substring()`'s second argument is an end index, not a length, so a response line could be cut to the wrong length whenever more than one line arrived in the same TCP chunk. The line separator was also only half-skipped, leaving a stray leading `\n` on every line after the first in that chunk.

### Changed

- **Upgraded `@companion-module/base` from `~1.4.1` to `^2.1.1`** (and `@companion-module/tools` to `^3.1.0`). Requires a current Companion release - installations on an older Companion should stay on the previous module version.

### Internal

- Migrated the module entrypoint from `runEntrypoint()` to a default export; `init`/`destroy`/`configUpdated` are now async per the base v2 API.
- Converted the module to ESM (`"type": "module"`).
- `companion/manifest.json`: `runtime.type` updated to `node22`; added the now-required top-level `"type": "connection"` field.
