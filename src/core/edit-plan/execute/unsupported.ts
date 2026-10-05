export function unsupportedCommand(command: never): never {
  throw new Error("Unsupported edit command", { cause: command });
}
