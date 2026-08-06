import { McClientService } from "../services/mc-client-service.js";
import { ClientAdapter, ClientAdapterKind } from "./client-adapter.js";
import { MineflayerAdapter } from "./mineflayer-adapter.js";

export interface ClientAdapterFactoryDependencies {
  mcClientService: McClientService;
}

export interface ClientAdapterFactory {
  create(kind: ClientAdapterKind): ClientAdapter;
}

export function createDefaultClientAdapterFactory(
  dependencies: ClientAdapterFactoryDependencies
): ClientAdapterFactory {
  return {
    create(kind) {
      return createClientAdapter(kind, dependencies);
    }
  };
}

export function createClientAdapter(
  kind: ClientAdapterKind,
  dependencies: ClientAdapterFactoryDependencies
): ClientAdapter {
  switch (kind) {
    case "mineflayer":
      return new MineflayerAdapter(dependencies.mcClientService);
    case "modded-client":
      throw new Error("Client adapter 'modded-client' is not implemented yet");
    default:
      return assertNeverAdapterKind(kind);
  }
}

function assertNeverAdapterKind(value: never): never {
  throw new Error(`Unsupported client adapter '${String(value)}'`);
}
