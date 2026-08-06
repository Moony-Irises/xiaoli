export interface StartupLifecycleHooks {
  loadPersistedState: () => Promise<void>;
  applyEnvironmentOverrides: () => void;
  reconcileRuntime: () => void;
}

export async function runStartupLifecycle(hooks: StartupLifecycleHooks): Promise<void> {
  await hooks.loadPersistedState();
  hooks.applyEnvironmentOverrides();
  hooks.reconcileRuntime();
}
