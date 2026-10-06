export type CreateTripFormValues = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  defaultCurrency: string;
  currencyDecimalPlaces: number;
};

export type CreateTripFormErrors = Partial<
  Record<keyof CreateTripFormValues, string>
>;

export function validateCreateTripForm(values: CreateTripFormValues) {
  const errors: CreateTripFormErrors = {};
  const trimmedName = values.name.trim();

  if (!trimmedName) errors.name = 'required';
  else if (trimmedName.length > 160) errors.name = 'tooLong';

  if (!values.timezone.trim()) errors.timezone = 'required';
  else {
    try {
      new Intl.DateTimeFormat('en', { timeZone: values.timezone.trim() });
    } catch {
      errors.timezone = 'invalidTimezone';
    }
  }

  if (!/^[A-Za-z]{3}$/.test(values.defaultCurrency.trim())) {
    errors.defaultCurrency = 'invalidCurrency';
  }

  if (
    !Number.isInteger(values.currencyDecimalPlaces) ||
    values.currencyDecimalPlaces < 0 ||
    values.currencyDecimalPlaces > 4
  ) {
    errors.currencyDecimalPlaces = 'invalidDecimalPlaces';
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'endBeforeStart';
  }

  return errors;
}
