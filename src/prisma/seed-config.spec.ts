import { resolveSeedAccounts } from './seed-config';

describe('resolveSeedAccounts', () => {
  const developmentEnvironment = {
    NODE_ENV: 'development',
    SEED_SYSTEM_PASSWORD: 'system-development-password',
    SEED_ADMIN_PASSWORD: 'admin-development-password',
  };

  it('resolves each seeded account from its own environment credential', () => {
    expect(resolveSeedAccounts(developmentEnvironment)).toEqual([
      {
        code: 'SYSTEM',
        username: 'system',
        password: 'system-development-password',
        name: 'System',
      },
      {
        code: 'ADMIN',
        username: 'admin',
        password: 'admin-development-password',
        name: 'Admin',
      },
    ]);
  });

  it('rejects seed execution outside development', () => {
    expect(() =>
      resolveSeedAccounts({
        ...developmentEnvironment,
        NODE_ENV: 'production',
      })
    ).toThrow('NODE_ENV=development');
  });

  it('rejects a missing required credential', () => {
    const { SEED_ADMIN_PASSWORD: _ignored, ...missingAdminPassword } =
      developmentEnvironment;

    expect(() => resolveSeedAccounts(missingAdminPassword)).toThrow(
      'SEED_ADMIN_PASSWORD'
    );
  });

  it('rejects a blank required credential', () => {
    expect(() =>
      resolveSeedAccounts({
        ...developmentEnvironment,
        SEED_SYSTEM_PASSWORD: '   ',
      })
    ).toThrow('SEED_SYSTEM_PASSWORD');
  });
});
