import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '../auth/auth-context';
import {
  changeLanguage,
  SUPPORTED_LANGUAGES,
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

export function useCurrentProfile(repository?: ProfileRepository) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: profileKeys.current(user?.id ?? 'anonymous'),
    enabled: Boolean(user),
    queryFn: () =>
      (repository ?? getProfileRepository()).getCurrent(user?.id ?? ''),
  });

  useEffect(() => {
    const language = query.data
      ? toSupportedLanguage(query.data.language)
      : undefined;

    if (language) changeLanguage(language);
  }, [query.data]);

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
