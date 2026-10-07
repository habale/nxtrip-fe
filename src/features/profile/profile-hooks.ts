import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '../auth/auth-context';
import {
  changeLanguage,
  SUPPORTED_LANGUAGES,
  takePendingSignupLanguage,
  type SupportedLanguage,
} from '../../shared/i18n';
import {
  getProfileRepository,
  type Profile,
  type ProfileRepository,
} from './profile-repository';

export const profileKeys = {
  all: ['profile'] as const,
  current: (userId: string) => [...profileKeys.all, 'current', userId] as const,
};

function toSupportedLanguage(language: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((supported) => supported === language);
}

function isFirstSignIn(createdAt: string, lastSignInAt?: string) {
  if (!lastSignInAt) return false;
  const created = Date.parse(createdAt);
  const lastSignIn = Date.parse(lastSignInAt);

  return (
    Number.isFinite(created) &&
    Number.isFinite(lastSignIn) &&
    Math.abs(lastSignIn - created) < 60_000
  );
}

export function useCurrentProfile(repository?: ProfileRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: profileKeys.current(user?.id ?? 'anonymous'),
    enabled: Boolean(user),
    queryFn: () =>
      (repository ?? getProfileRepository()).getCurrent(user?.id ?? ''),
  });

  useEffect(() => {
    if (!query.data || !user) return;

    const profileLanguage = toSupportedLanguage(query.data.language);
    const signupLanguage = takePendingSignupLanguage();

    if (
      signupLanguage &&
      isFirstSignIn(user.created_at, user.last_sign_in_at)
    ) {
      void (repository ?? getProfileRepository())
        .updateLanguage(user.id, signupLanguage)
        .then((profile) => {
          queryClient.setQueryData(profileKeys.current(profile.id), profile);
          changeLanguage(signupLanguage);
        })
        .catch(() => {
          if (profileLanguage) changeLanguage(profileLanguage);
        });
      return;
    }

    if (profileLanguage) changeLanguage(profileLanguage);
  }, [query.data, queryClient, repository, user]);

  return query;
}

export function useUpdateProfileLanguage(repository?: ProfileRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (language: SupportedLanguage) => {
      if (!user) throw new Error('Authentication is required.');

      return (repository ?? getProfileRepository()).updateLanguage(
        user.id,
        language,
      );
    },
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(profileKeys.current(profile.id), profile);
      const language = toSupportedLanguage(profile.language);
      if (language) changeLanguage(language);
    },
  });
}
