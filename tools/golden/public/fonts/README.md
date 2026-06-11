# Fixture fonts

- `inter-700-latin.woff2` — Inter Bold, latin subset, by Rasmus Andersson.
  Licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).
  Source: Google Fonts (`fonts.googleapis.com/css2?family=Inter:wght@700`, v20).

These fonts exist so golden tests can hash text pixels exactly: an embedded
font removes the platform-dependence of system font fallbacks. They are test
fixtures only and are not shipped in any published package.
