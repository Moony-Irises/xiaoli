import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface ServerConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export function parseConfig(): ServerConfig {
  const parsed = yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
      default: process.env.MINECRAFT_SERVER_HOST || 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Bot username',
      default: process.env.MINECRAFT_BOT_USERNAME
    })
    .option('password', {
      type: 'string',
      description: 'Bot password (for Yggdrasil auth)',
      default: process.env.MINECRAFT_BOT_PASSWORD
    })
    .help()
    .alias('help', 'h')
    .parseSync();

  if (!parsed.username || !parsed.password) {
    throw new Error('Set MINECRAFT_BOT_USERNAME and MINECRAFT_BOT_PASSWORD before starting the reference bot.');
  }

  return parsed as ServerConfig;
}
