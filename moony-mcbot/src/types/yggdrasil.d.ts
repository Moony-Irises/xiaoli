declare module "yggdrasil" {
  interface YggdrasilAuthRequest {
    user: string;
    pass: string;
    token?: string;
    agent?: string;
    version?: number;
    requestUser?: boolean;
  }

  interface YggdrasilProfile {
    id: string;
    name: string;
  }

  interface YggdrasilAuthResponse {
    accessToken: string;
    clientToken: string;
    selectedProfile: YggdrasilProfile;
  }

  interface YggdrasilClient {
    auth(req: YggdrasilAuthRequest): Promise<YggdrasilAuthResponse>;
  }

  interface YggdrasilFactoryOptions {
    host: string;
  }

  type YggdrasilFactory = (options: YggdrasilFactoryOptions) => YggdrasilClient;

  const createYggdrasil: YggdrasilFactory;
  export default createYggdrasil;
}
