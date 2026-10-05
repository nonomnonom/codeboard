# Changesets

Run `npm run changeset` for a user-facing change and commit the generated Markdown file with that change. Choose `codeboard-studio`, its release type, and a concrete summary. Documentation and tooling changes that do not require a package release can omit a changeset.

Maintainers run `npm run version-packages` to consume changesets, update the changelog and lockfile, and synchronize plugin versions, website metadata, and bundled references. Review and commit the result through a passing pull request, then tag the merged commit as `vVERSION`. The existing `release.yml` workflow tests and publishes the exact npm tarball through OIDC.

Do not run `changeset publish` separately: npm publication belongs to the release workflow. See [Contributing](../CONTRIBUTING.md#releases) and the [Changesets guide](https://changesets.dev/guide/getting-started).
