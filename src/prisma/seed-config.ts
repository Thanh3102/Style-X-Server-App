import { accounts, SeedAccountDefinition } from './seed-data/account';

export type SeedAccount = Omit<SeedAccountDefinition, 'passwordEnv'> & {
  password: string;
};

function requiredDevelopmentPassword(
  environment: NodeJS.ProcessEnv,
  passwordEnv: SeedAccountDefinition['passwordEnv']
): string {
  const password = environment[passwordEnv];

  if (!password?.trim()) {
    throw new Error(`Missing required ${passwordEnv} for Prisma seed.`);
  }

  return password;
}

export function resolveSeedAccounts(
  environment: NodeJS.ProcessEnv = process.env
): SeedAccount[] {
  if (environment.NODE_ENV !== 'development') {
    throw new Error(
      'Prisma seed is restricted to NODE_ENV=development; refusing to create default accounts.'
    );
  }

  return accounts.map((account) => ({
    code: account.code,
    username: account.username,
    name: account.name,
    password: requiredDevelopmentPassword(environment, account.passwordEnv),
  }));
}
