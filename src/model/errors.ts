export type ErrorCode =
  | "OPERATION_FAILED"
  | "MISSING_DEPENDENCY"
  | "INVALID_ARGUMENT"
  | "INVALID_CURSOR"
  | "STALE_CURSOR"
  | "REVISION_CONFLICT"
  | "RESOURCE_LIMIT"
  | "REQUEST_ID_REUSED"
  | "ASSET_MISSING"
  | "ASSET_CHECKSUM_MISMATCH"
  | "CANCELLED"
  | "SCHEMA_MIGRATION_REQUIRED";

export class CodeboardError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: Record<string, unknown>; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CodeboardError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = structuredClone(options.details ?? {});
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: structuredClone(this.details),
    };
  }
}

/** Attach the failing sub-edit without attributing whole-batch validation to an arbitrary edit. */
export function throwEditError(
  cause: unknown,
  editDomain: "shot-animation" | "editorial" | "studio-audio",
  editIndex: number,
  editOperation: string,
): never {
  const context = { editDomain, editIndex, editOperation };
  if (cause instanceof CodeboardError)
    throw new CodeboardError(cause.code, cause.message, {
      retryable: cause.retryable,
      details: { ...cause.details, ...context },
      cause,
    });
  throw new CodeboardError(
    "INVALID_ARGUMENT",
    cause instanceof Error ? cause.message : String(cause),
    { details: context, cause },
  );
}
