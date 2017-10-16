# seneca-lucius

**Lucius** works with Seneca.js and offers a different way of writing Seneca plugins. It integrates 100% with Seneca 3.x but does not depend on it.

## Why "Lucius"?

[Seneca the Younger](https://en.wikipedia.org/wiki/Seneca_the_Younger)'s full name was Lucius Annaeus Seneca.

## Features

* A standardized format for errors.
* A registry of error codes (dev-defined).
* A standardized format for messaging payloads.
* A common interface for sending successful or failure Seneca messages.
* A common logging interface (built on top of Winston).
* A simple way of integrating all of the above with a Seneca plugin.
* Optional JSON schema validation of message arguments and message output.
* A middleware for integrating with Swagger-ified connect apps.

## History

* v1.2.0, 2017-10-16: Complete rewrite of Lucius.register(), NOT backwards compatible! Changes:
  * Complete rewrite of Lucius.register(), greatly simplifies plugin code.
  * Clean up definitions file, leave only examples.
  * Renamed Message and Responder to LuciusMessage and LuciusResponder.
  * Implement JSON schema validation support (with ajv) for arguments and output.
  * Pass only the relevant parts of the payload to plugins (trim Seneca routing info).
* v1.0.1, 2017-10-10: Minimal changes to make it work on its own.
* v1.0.0, 2017-10-10: Copied verbatim from the [World-Cleanup-Day](https://github.com/letsdoitworld/World-Cleanup-Day/) project.

## Status and things to do

v1 is fairly over-engineered.

### General goals

* Documentation, examples.
* A cleaner connect middleware.
* Stop hardcoding the error registry.

## Authors and maintainers

Lucius was developed as FOSS by [Qualitance](https://github.com/qualitance) for the [World Cleanup Day](https://github.com/letsdoitworld/World-Cleanup-Day/) project initiated by the [Let's Do It World](https://github.com/letsdoitworld) NGO.

Maintainer is [Ciprian Popovici](https://github.com/cprpopqual).

## License

Lucius is licensed under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html).

