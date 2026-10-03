import {
  createI18n,
  detectLanguage,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from '.';

describe('i18n', () => {
  it('resolves English and Vietnamese translations across namespaces', () => {
    const english = createI18n('en');
    const vietnamese = createI18n('vi');

    expect(english.t('actions.save')).toBe('Save');
    expect(english.t('network', { ns: 'errors' })).toBe(
      'Check your connection and try again.',
    );
    expect(vietnamese.t('actions.save')).toBe('Lưu');
    expect(vietnamese.t('network', { ns: 'errors' })).toBe(
      'Hãy kiểm tra kết nối và thử lại.',
    );
  });

  it('falls back to English for an unsupported language', () => {
    const instance = createI18n('fr');

    expect(instance.resolvedLanguage).toBe(FALLBACK_LANGUAGE);
    expect(instance.t('states.loading')).toBe('Loading…');
  });

  it('prefers a persisted supported language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'vi');

    expect(detectLanguage()).toBe('vi');

    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });
});
