# Help section for the AnalogWay Midra module

With this module you can control all graphic switchers from the legacy Midra series by AnalogWay, e.g. the Pulse2 or Pulse 3G, but not the models from the new Midra 4K series.  
If you want to control devices from Midra 4K series or Alta 4K series, please use the Analog Way AWJ module.

Midra Series devices allow only one connection to the ethernet port at the same time. So you can either use RCS2 or Companion, but not both simultaneously - unless you use a connection proxy like the AW Gateway app from Analog Way, or enable this module's built-in Gateway (see below).
This module only supports ethernet connections to port 10500 of the device, serial connections are not supported.

## Built-in Gateway

Instead of running the separate AW Gateway application, you can enable "Enable local Gateway" in this module's connection settings. Companion will then hold the single connection to the Midra unit itself, and open a local TCP port (default 10500, matching the unit's own port) that other Midra clients, e.g. RCS2, can connect to instead of connecting to the unit directly. Point RCS2 at the IP address of the machine running Companion instead of the Midra unit, and it will work without further configuration changes on the RCS2 side.

When working with memories keep in mind, that only eight memories are stored on the device. That means you can't use the additional memories provided by RCS2 from anything else than RCS2 itself. Only the first eight memories are available from Companion.

## Changelog

### 2.1.0-beta1

**Added**
- Built-in RCS2/Companion Gateway, so you no longer need the separate AW Gateway app to share the connection with RCS2 (see above).
- "Memory active" feedback, highlighting a button when a given screen memory is currently loaded into Program/Preview.

**Fixed**
- Incoming data from the unit could be parsed incorrectly when more than one response line arrived in the same TCP chunk.

**Changed**
- Upgraded to a current version of the underlying Companion module framework. Requires a current Companion release - installations on an older Companion should stay on the previous module version.
