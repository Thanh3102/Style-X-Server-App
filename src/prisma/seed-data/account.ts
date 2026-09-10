export type SeedPasswordEnvironmentKey =
  | 'SEED_SYSTEM_PASSWORD'
  | 'SEED_ADMIN_PASSWORD';

export type SeedAccountDefinition = {
  code: string;
  username: string;
  name: string;
  passwordEnv: SeedPasswordEnvironmentKey;
};

export const accounts: readonly SeedAccountDefinition[] = [
  {
    code: 'SYSTEM',
    username: 'system',
    passwordEnv: 'SEED_SYSTEM_PASSWORD',
    name: 'System',
  },
  {
    code: 'ADMIN',
    username: 'admin',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    name: 'Admin',
  },
];
