import type {
  ClientMovementAction,
  ClientMovementEvent
} from "./client-adapter.js";

export function getCurrentMovementFailure(
  event: ClientMovementEvent,
  currentMovementId: string | undefined,
  expectedAction: ClientMovementAction
): ClientMovementEvent | null {
  if (!currentMovementId) return null;
  if (event.type !== "movement_failed") return null;
  if (event.movementId !== currentMovementId) return null;
  if (event.action !== expectedAction) return null;
  return event;
}
