import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { i18n, LANGUAGE_STORAGE_KEY } from '../../shared/i18n';
import { useCurrentProfile, useUpdateProfileLanguage } from './profile-hooks';
import type { Profile, ProfileRepository } from './profile-repository';

const profile: Profile = {
  id: 'user-123',
  display_name: 'Alex Morgan',
  email: 'alex@example.com',
  avatar_url: 'https://example.com/avatar.jpg',
  language: 'vi',
  theme: 'system',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const auth: AuthContextValue = {
    session: null,
    user: { id: profile.id } as User,
    status: 'ready',
    error: null,
    signInWithGoogle: vi.fn(),
    signInAsGuest: vi.fn(),
    signOut: vi.fn(),
  };

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };
}

function ProfileProbe({ repository }: { repository: ProfileRepository }) {
  const currentProfile = useCurrentProfile(repository);
  const languageMutation = useUpdateProfileLanguage(repository);

  return (
    <div>
      <span>{currentProfile.data?.display_name ?? 'loading'}</span>
      <button type="button" onClick={() => languageMutation.mutate('en')}>
        Use English
      </button>
    </div>
  );
}

describe('profile hooks', () => {
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('loads the current profile and synchronizes its language', async () => {
    const repository = {
      getCurrent: vi.fn(async () => profile),
      updateLanguage: vi.fn(async () => ({ ...profile, language: 'en' })),
    } satisfies ProfileRepository;

    render(<ProfileProbe repository={repository} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument();
    expect(repository.getCurrent).toHaveBeenCalledWith('user-123');
    await waitFor(() => expect(i18n.language).toBe('vi'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  });

  it('persists a language update and refreshes the cached profile', async () => {
    const user = userEvent.setup();
    const repository = {
      getCurrent: vi.fn(async () => profile),
      updateLanguage: vi.fn(async () => ({ ...profile, language: 'en' })),
    } satisfies ProfileRepository;

    render(<ProfileProbe repository={repository} />, {
      wrapper: createWrapper(),
    });
    await screen.findByText('Alex Morgan');
    await user.click(screen.getByRole('button', { name: 'Use English' }));

    await waitFor(() =>
      expect(repository.updateLanguage).toHaveBeenCalledWith('user-123', 'en'),
    );
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
