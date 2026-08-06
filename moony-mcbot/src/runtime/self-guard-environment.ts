export interface SelfGuardEnvironmentSnapshot {
  isDay: boolean;
  isRaining: boolean;
}

export interface SelfGuardEnvironmentTransitions {
  nightStarted: boolean;
  rainStarted: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

export function readSelfGuardEnvironment(source: unknown): SelfGuardEnvironmentSnapshot {
  const sourceRecord = asRecord(source);
  const timeRecord = asRecord(sourceRecord?.time);
  return {
    isDay: Boolean(timeRecord?.isDay),
    isRaining: Boolean(sourceRecord?.isRaining)
  };
}

export function detectSelfGuardEnvironmentTransitions(
  previous: Partial<SelfGuardEnvironmentSnapshot> | undefined,
  current: SelfGuardEnvironmentSnapshot
): SelfGuardEnvironmentTransitions {
  return {
    nightStarted: previous?.isDay === true && !current.isDay,
    rainStarted: previous?.isRaining === false && current.isRaining
  };
}
