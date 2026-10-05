import type { Id, ProjectLock } from "../../model/types.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readLock" | "actor">;

export function lock(
  host: Host,
  targetType: ProjectLock["targetType"],
  targetId: Id,
  reason: string,
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction(
    "lock project target",
    [targetId],
    options.expectedVersion,
    (document, nextId) => {
      if (
        document.locks.some((lock) => lock.targetType === targetType && lock.targetId === targetId)
      )
        throw new Error(`Target is already locked: ${targetId}`);
      id = nextId("lock");
      document.locks.push({
        id,
        targetType,
        targetId,
        owner: host.actor,
        reason,
        createdAt: new Date().toISOString(),
      });
    },
  );
  return id;
}

export function unlock(host: Host, lockId: Id, options: MutationOptions = {}): void {
  const lock = host._readLock(lockId);
  if (lock.owner !== host.actor) throw new Error(`Only ${lock.owner} can unlock ${lock.targetId}`);
  host._applyProduction(
    "unlock project target",
    [lock.targetId],
    options.expectedVersion,
    (document) => {
      document.locks = document.locks.filter((entry) => entry.id !== lockId);
    },
  );
}
