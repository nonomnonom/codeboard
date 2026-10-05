# Codeboard v1.0.0 release scope

The active objective is to launch Codeboard v1.0.0: the code-first 2D engine,
npm package, matching docs, examples, plugin and website.

The user resumed release work on 2026-10-06 and authorized review, fixes and
publication. Validate the final combined tree, then publish through release CI
and verify the matching website and public installation. Version 1.0.0 remains
a candidate until publication succeeds.

The [distribution/runtime audit](distribution-audit.md) records the current npm-only
pipeline, feature/test map, corrections and local evidence.

[Release gates](acceptance.md) define the work and completion
criteria. The [candidate audit](audit-2026-10-06.md) records
concrete defects and verification gaps. [Implementation ownership](../architecture.md)
identifies where fixes belong.

Finish incomplete supported workflows, fix defects, reconcile documentation and
verify installed artifacts. Add functionality only when a demonstrated v1 need
requires it. The goal is complete after publication, matching website deployment,
and verification of public installation.

For supported behavior, use [fundamentals](../../docs/start/what-you-can-make.md),
[project concepts](../../docs/start/project-model.md), [production workflow](../../docs/workflow/production.md)
and the [API references](../../docs/reference/index.md).
