export interface FocusPosition {
  x: number;
  y: number;
  z: number;
}

export interface FocusObserver {
  position: FocusPosition;
  eyeHeight: number;
  yaw: number;
  pitch: number;
}

export interface FocusEntityCandidate {
  position: FocusPosition;
}

function normalizeAngleRad(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function buildLookDirection(yaw: number, pitch: number): FocusPosition {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch)
  };
}

function dot(a: FocusPosition, b: FocusPosition): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function selectFocusedEntity<T extends FocusEntityCandidate>(
  observer: FocusObserver,
  candidates: readonly T[],
  maxReach: number,
  cursorBlockDistance = Number.POSITIVE_INFINITY
): T | null {
  const eye = {
    x: observer.position.x,
    y: observer.position.y + observer.eyeHeight,
    z: observer.position.z
  };
  const lookDirection = buildLookDirection(observer.yaw, observer.pitch);
  let selected: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const dx = candidate.position.x - eye.x;
    const dy = candidate.position.y + 0.9 - eye.y;
    const dz = candidate.position.z - eye.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!Number.isFinite(distance) || distance > maxReach || distance < 0.01) continue;

    const directionToCandidate = {
      x: dx / distance,
      y: dy / distance,
      z: dz / distance
    };
    const forwardness = dot(lookDirection, directionToCandidate);
    if (forwardness < 0.92) continue;

    const yawToCandidate = Math.atan2(-dx, -dz);
    const pitchToCandidate = -Math.atan2(dy, horizontalDistance);
    const yawDifference = Math.abs(normalizeAngleRad(yawToCandidate - observer.yaw));
    const pitchDifference = Math.abs(pitchToCandidate - observer.pitch);
    const score = yawDifference
      + pitchDifference * 0.7
      + (1 - forwardness) * 1.5
      + distance * 0.015;

    if (distance > cursorBlockDistance + 0.75) continue;
    if (score <= 0.26 && score < bestScore) {
      selected = candidate;
      bestScore = score;
    }
  }

  return selected;
}
