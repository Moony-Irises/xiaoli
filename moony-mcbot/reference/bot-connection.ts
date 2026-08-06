import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements } = pathfinderPkg;
import minecraftData from 'minecraft-data';
// @ts-ignore
import yggdrasil from 'yggdrasil';

const SUPPORTED_MINECRAFT_VERSION = '1.20.1';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface BotConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
}

interface ConnectionCallbacks {
  onLog: (level: string, message: string) => void;
  onChatMessage: (username: string, message: string) => void;
}

export class BotConnection {
  private bot: mineflayer.Bot | null = null;
  private state: ConnectionState = 'disconnected';
  private config: BotConfig;
  private callbacks: ConnectionCallbacks;
  private isReconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelayMs: number;

  constructor(config: BotConfig, callbacks: ConnectionCallbacks, reconnectDelayMs = 2000) {
    this.config = config;
    this.callbacks = callbacks;
    this.reconnectDelayMs = reconnectDelayMs;
  }

  getBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getConfig(): BotConfig {
    return this.config;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  private formatUUID(uuid: string): string {
    // 格式化 UUID 为标准格式: 8-4-4-4-12
    const cleanUUID = uuid.replace(/-/g, '');
    if (cleanUUID.length !== 32) {
      return uuid; // 如果不是有效长度，返回原始值
    }
    return `${cleanUUID.substring(0, 8)}-${cleanUUID.substring(8, 12)}-${cleanUUID.substring(12, 16)}-${cleanUUID.substring(16, 20)}-${cleanUUID.substring(20, 32)}`;
  }

  connect(): void {
    // LittleSkin Yggdrasil API endpoint - with /authserver suffix for proper endpoint construction
    const yggHost = 'https://littleskin.cn/api/yggdrasil/authserver';
    this.callbacks.onLog('info', `Connecting to Minecraft server at ${this.config.host}:${this.config.port}...`);
    
    const yggClient = new yggdrasil({
      host: yggHost,
    });

    yggClient.auth({
      user: this.config.username,
      pass: this.config.password,
    }, (err: any, result: any) => {
      if (err) {
        this.callbacks.onLog('error', `Yggdrasil auth failed: ${err.message || err}`);
        this.state = 'disconnected';
        return;
      }

      this.callbacks.onLog('info', `Yggdrasil auth success for profile: ${result.selectedProfile.name}`);
      
      // 输出认证响应详情用于诊断
      this.callbacks.onLog('debug', `Auth response - Profile ID: ${result.selectedProfile.id}`);
      this.callbacks.onLog('debug', `Auth response - Profile Name: ${result.selectedProfile.name}`);
      this.callbacks.onLog('debug', `Auth response - Access Token present: ${!!result.accessToken}`);
      this.callbacks.onLog('debug', `Auth response - Client Token present: ${!!result.clientToken}`);
      
      // 使用 Yggdrasil 返回的 profile 信息，并格式化 UUID
      const selectedProfile = {
        id: this.formatUUID(result.selectedProfile.id),
        name: result.selectedProfile.name,
      };
      
      this.callbacks.onLog('info', `Using game profile: ${selectedProfile.name} (UUID: ${selectedProfile.id})`);

      const botOptions: mineflayer.BotOptions = {
        host: this.config.host,
        port: this.config.port,
        version: SUPPORTED_MINECRAFT_VERSION,
        username: result.selectedProfile.name,
        session: {
          accessToken: result.accessToken,
          clientToken: result.clientToken,
          selectedProfile: selectedProfile,
        },
        plugins: { pathfinder },
      };

      this.callbacks.onLog('info', `Creating bot connection to ${this.config.host}:${this.config.port}...`);
      this.callbacks.onLog('debug', `Bot username to use: ${result.selectedProfile.name}`);
      this.bot = mineflayer.createBot(botOptions) as mineflayer.Bot;
      this.state = 'connecting';
      this.isReconnecting = false;
      this.registerEventHandlers(this.bot);
    });
  }

  private registerEventHandlers(bot: mineflayer.Bot | null): void {
    if (!bot) {
      this.callbacks.onLog('error', 'Bot is null, cannot register handlers');
      this.state = 'disconnected';
      return;
    }

    bot.once('spawn', async () => {
      this.state = 'connected';
      this.callbacks.onLog('info', 'Bot spawned in world');

      const mcData = minecraftData(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);

      bot.chat('LLM-powered bot ready to receive instructions!');
      this.callbacks.onLog('info', `Bot connected successfully. Username: ${this.config.username}, Server: ${this.config.host}:${this.config.port}`);
    });

    bot.on('chat', (username, message) => {
      if (username === bot.username) return;
      this.callbacks.onChatMessage(username, message);
    });

    bot.on('kicked', (reason) => {
      this.callbacks.onLog('error', `Bot was kicked from server: ${this.formatError(reason)}`);
      this.state = 'disconnected';
      bot.quit();
    });

    bot.on('error', (err) => {
      const errorCode = (err as { code?: string }).code || 'Unknown error';
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.callbacks.onLog('error', `Bot connection error [${errorCode}]: ${errorMsg}`);

      if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
        this.callbacks.onLog('warn', `Connection refused/timeout - server may not be running at ${this.config.host}:${this.config.port}`);
        this.state = 'disconnected';
        this.attemptReconnect();
      }
    });

    bot.on('login', () => {
      this.callbacks.onLog('info', 'Bot logged in successfully');
    });

    bot.on('end', (reason) => {
      this.callbacks.onLog('info', `Bot disconnected: ${this.formatError(reason)}`);

      if (this.state === 'connected') {
        this.state = 'disconnected';
      }

      if (this.bot === bot) {
        try {
          bot.removeAllListeners();
          this.bot = null;
          this.callbacks.onLog('info', 'Bot instance cleaned up after disconnect');
        } catch (err) {
          this.callbacks.onLog('warn', `Error cleaning up bot on end event: ${this.formatError(err)}`);
        }
      }
    });
  }

  attemptReconnect(): void {
    if (this.isReconnecting || this.state === 'connecting') {
      return;
    }

    this.isReconnecting = true;
    this.state = 'connecting';
    this.callbacks.onLog('info', `Attempting to reconnect to ${this.config.host}:${this.config.port}...`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.bot) {
        try {
          this.bot.removeAllListeners();
          this.bot.quit('Reconnecting...');
        } catch (err) {
          this.callbacks.onLog('warn', `Error while cleaning up old bot: ${this.formatError(err)}`);
        }
      }

      this.connect();
    }, this.reconnectDelayMs);
  }

  async checkConnectionAndReconnect(): Promise<{ connected: boolean; message?: string }> {
    const currentState = this.state;

    if (currentState === 'disconnected') {
      this.attemptReconnect();

      const maxWaitTime = this.reconnectDelayMs + 5000;
      const pollInterval = 100;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        if (this.state === 'connected') {
          return { connected: true };
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      const errorMessage =
        `Cannot connect to Minecraft server at ${this.config.host}:${this.config.port}\n\n` +
        `Please ensure:\n` +
        `1. Minecraft server is running on ${this.config.host}:${this.config.port}\n` +
        `2. Server is accessible from this machine\n` +
        `3. Server version is compatible (latest supported: ${SUPPORTED_MINECRAFT_VERSION})\n\n` +
        `For setup instructions, visit: https://github.com/yuniko-software/minecraft-mcp-server`;

      return { connected: false, message: errorMessage };
    }

    if (currentState === 'connecting') {
      return { connected: false, message: 'Bot is connecting to the Minecraft server. Please wait a moment and try again.' };
    }

    return { connected: true };
  }

  cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.bot) {
      try {
        this.bot.quit('Server shutting down');
      } catch (err) {
        this.callbacks.onLog('warn', `Error during cleanup: ${this.formatError(err)}`);
      }
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
