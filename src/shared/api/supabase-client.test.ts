import {
  getSupabaseClient,
  inspectSupabaseConfiguration,
} from './supabase-client';

describe('Supabase client infrastructure', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports sanitized configuration without reading application data', () => {
    expect(
      inspectSupabaseConfiguration({
        VITE_SUPABASE_URL: ' https://project.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' test-anon-key ',
      }),
    ).toEqual({
      configured: true,
      url: 'https://project.supabase.co',
      anonKeyPresent: true,
    });
  });

  it('reports incomplete configuration without exposing the key', () => {
    expect(
      inspectSupabaseConfiguration({
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: 'secret-value',
      }),
    ).toEqual({ configured: false, url: null, anonKeyPresent: true });
  });

  it('initializes one typed client instance', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });
});
