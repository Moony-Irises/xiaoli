import createYggdrasil from "yggdrasil";
import { AuthSession } from "../types.js";
import { normalizeAuthApiBase } from "../utils/identity.js";
import { log } from "../logger.js";

function toUndashedUuid(uuid: string): string {
  return uuid.replace(/-/g, "");
}

export class AuthService {
  async authenticate(apiBaseUrl: string, username: string, password: string, botId: string): Promise<AuthSession> {
    const host = normalizeAuthApiBase(apiBaseUrl);
    const client = createYggdrasil({ host });

    log("info", "Authenticating with Yggdrasil", { botId, authApiBase: host, username });

    const raw = await client.auth({
      user: username,
      pass: password,
      agent: "Minecraft",
      version: 1
    });

    if (!raw?.accessToken || !raw?.clientToken || !raw?.selectedProfile?.id || !raw?.selectedProfile?.name) {
      throw new Error("Authentication response missing required fields");
    }

    const normalizedId = toUndashedUuid(raw.selectedProfile.id);

    const result: AuthSession = {
      accessToken: raw.accessToken,
      clientToken: raw.clientToken,
      selectedProfile: {
        id: normalizedId,
        name: raw.selectedProfile.name
      }
    };

    log("info", "Yggdrasil auth succeeded", {
      botId,
      authApiBase: host,
      profileName: result.selectedProfile.name,
      profileId: result.selectedProfile.id,
      accessTokenPresent: !!result.accessToken,
      clientTokenPresent: !!result.clientToken
    });

    return result;
  }
}
