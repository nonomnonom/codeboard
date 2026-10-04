# Security

Codeboard is pre-1.0 development software. Security fixes target the current development branch and latest published version, if one exists. Older releases do not have a separate maintenance guarantee.

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/nonomnonom/codeboard/security/advisories/new) when available. If it has not yet been enabled, contact the maintainer through a private channel on [their GitHub profile](https://github.com/nonomnonom). If no private channel is available, open an issue requesting one **without exploit details or sensitive data**. There is no promised response SLA or bounty program.

Include the affected version or commit, operating system, Node version, a minimal reproduction, impact, and whether the report may contain private assets. Coordinate disclosure before publishing exploit details.

## Trust boundaries

- JavaScript/TypeScript authoring files are executable local programs with normal process permissions. Run only code you trust.
- `.cboard` projects and imported brush resources are data, but native graphics and parsing dependencies still process them. Resource bounds and validation are not a general-purpose sandbox.
- Preview is a read-only loopback service, not an authenticated public hosting service. Do not expose it directly to the Internet.
- FFmpeg is supplied separately by the user. Review the provenance of executables, fonts, and imported resources.

Do not include secrets, private project databases, or proprietary artwork in public bug reports.
