import { CodeboardError } from "../model/errors.js";
import { CommanderError } from "commander";

type ErrorReport = ReturnType<CodeboardError["toJSON"]> & {
  causes?: ErrorReport[];
  causesTruncated?: number;
};

/** Format command failures without serializing stacks or unbounded cause chains. */
export function commandErrorReport(error: unknown, depth = 0): ErrorReport {
  const report: ErrorReport =
    error instanceof CodeboardError
      ? error.toJSON()
      : error instanceof CommanderError
        ? {
            code: "INVALID_ARGUMENT",
            message: error.message,
            retryable: false,
            details: { parserCode: error.code },
          }
        : {
            code:
              error instanceof Error && error.name === "AbortError"
                ? "CANCELLED"
                : "OPERATION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Command failed with a non-Error value",
            retryable: false,
            details: error instanceof Error ? { name: error.name } : {},
          };
  if (error instanceof AggregateError) {
    if (depth >= 3) report.causesTruncated = error.errors.length;
    else {
      report.causes = error.errors
        .slice(0, 8)
        .map((failure) => commandErrorReport(failure, depth + 1));
      if (error.errors.length > 8) report.causesTruncated = error.errors.length - 8;
    }
  } else if (error instanceof Error && error.cause !== undefined) {
    if (depth >= 3) report.causesTruncated = 1;
    else report.causes = [commandErrorReport(error.cause, depth + 1)];
  }
  return report;
}
