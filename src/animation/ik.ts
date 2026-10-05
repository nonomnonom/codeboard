import { CodeboardError } from "../model/errors.js";

export interface TwoBoneSolution {
  rootRotation: number;
  elbowRotation: number;
  elbow: { x: number; y: number };
  end: { x: number; y: number };
  reachable: boolean;
  error: number;
}

export function solveTwoBoneIK(
  origin: { x: number; y: number },
  target: { x: number; y: number },
  upperLength: number,
  lowerLength: number,
  bend: 1 | -1 = 1,
): TwoBoneSolution {
  if (
    ![origin.x, origin.y, target.x, target.y, upperLength, lowerLength].every(Number.isFinite) ||
    upperLength <= 0 ||
    lowerLength <= 0 ||
    (bend !== 1 && bend !== -1)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "IK requires finite coordinates, positive lengths and bend +1 or -1",
      {
        details: { reason: "INVALID_IK_INPUT" },
      },
    );
  const scale = Math.max(upperLength, lowerLength),
    minimum = Math.abs(upperLength - lowerLength),
    maximum = upperLength + lowerLength;
  if (!Number.isFinite(maximum) || Math.min(upperLength, lowerLength) / scale < Number.EPSILON)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "IK lengths exceed the supported numerical range",
      {
        details: { reason: "IK_LENGTH_RANGE" },
      },
    );
  const dx = target.x - origin.x,
    dy = target.y - origin.y,
    distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "IK target offset exceeds the supported numerical range",
      {
        details: { reason: "IK_TARGET_RANGE" },
      },
    );
  const reach = Math.max(minimum, Math.min(maximum, distance)),
    a = upperLength / scale,
    b = lowerLength / scale,
    d = reach / scale;
  const elbowRotation =
    bend * Math.acos(Math.max(-1, Math.min(1, (d * d - a * a - b * b) / (2 * a * b))));
  const direction = distance === 0 ? 0 : Math.atan2(dy, dx);
  const rootRotation =
    reach === 0
      ? direction
      : direction - Math.atan2(b * Math.sin(elbowRotation), a + b * Math.cos(elbowRotation));
  const elbow = {
    x: origin.x + upperLength * Math.cos(rootRotation),
    y: origin.y + upperLength * Math.sin(rootRotation),
  };
  const end = {
    x: elbow.x + lowerLength * Math.cos(rootRotation + elbowRotation),
    y: elbow.y + lowerLength * Math.sin(rootRotation + elbowRotation),
  };
  if (![elbow.x, elbow.y, end.x, end.y].every(Number.isFinite))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "IK result exceeds the supported numerical range",
      {
        details: { reason: "IK_RESULT_RANGE" },
      },
    );
  return {
    rootRotation,
    elbowRotation,
    elbow,
    end,
    reachable: distance >= minimum && distance <= maximum,
    error: Math.hypot(end.x - target.x, end.y - target.y),
  };
}
