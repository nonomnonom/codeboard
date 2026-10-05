# Handle operation failures

Read the error code and details before retrying. Missing tools require configuration; version conflicts require reopening and preparing a new edit.

## Missing media executables

Movie export and the FFmpeg audio decoder report executable lookup failures (`ENOENT` or `ENOTDIR`) as `CodeboardError` with code `MISSING_DEPENDENCY`. Details contain `dependency` (`ffmpeg` or `ffprobe`), the selected `executable`, and the OS `reason`. This error is not automatically retryable: install/configure the executable before retrying. CLI entrypoints serialize this error using their existing structured error path.

The movie encoder waits for the child process to start before requesting its first PNG. Source validation and audio preparation may already have happened, and output parents or reserved/temporary files may have been created; existing cleanup rules still apply. Startup success does not prove codec availability or valid media. Permission failures, nonzero codec exits, malformed media and cancellation are not classified as missing dependencies. Cleanup failures can still surface as an AggregateError retaining the original dependency error. The optional capabilities probe remains a separate bounded availability report, not a prerequisite or a substitute for export-time checks.

## Locate a failing domain edit

Individual failures inside `reviseShotAnimation`, `reviseEditorialSequence` and `reviseStudioAudio` (including project adapters) carry zero-based `editIndex`, `editOperation` and `editDomain` (`shot-animation`, `editorial` or `studio-audio`) in `CodeboardError.details`. Typed errors retain their code, message, retryability, domain details and original cause. Generic operation failures become `INVALID_ARGUMENT` with the original message.

Inside a plan these fields coexist with `commandIndex` and `commandOperation`. For example, a rejected `clip.split` in the third edit of `studio.audio.edit` reports `editIndex: 2` and `editOperation: 'clip.split'`, alongside its split/fade diagnostic. Input-schema and final-state validation failures do not receive a guessed edit index. These algorithms continue to edit isolated drafts and return only after final validation; contextual errors do not publish partial drafts.

## History publication and exhausted counters

In-memory authoring transactions publish their undo entry and clear redo only after validation and audit recording succeed. Undo/redo prepare the restored document and its new audit record before moving history entries; an audit failure restores the current document and leaves the history entry available. This concerns session history, not a new durable-store transaction protocol.

ID allocation and audit-version advancement reject unsafe integer overflow with `RESOURCE_LIMIT`, using `details.reason: 'PROJECT_ID_LIMIT'` or `'PROJECT_VERSION_LIMIT'` and the current counter. Counters are never reset or wrapped automatically. Retain the source when a counter is exhausted; lowering counters can reuse identities and invalidate external references.
