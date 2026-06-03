export function toSafeDate(input: string | Date | null | undefined) {
  if (!input) {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatAppointmentDate(
  input: string | Date | null | undefined,
  locale: Intl.LocalesArgument = 'es-PR',
) {
  const date = toSafeDate(input);

  if (!date) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatAppointmentTime(
  input: string | Date | null | undefined,
  locale: Intl.LocalesArgument = 'es-PR',
) {
  const date = toSafeDate(input);

  if (!date) {
    return 'Hora no disponible';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatAppointmentDateTime(
  input: string | Date | null | undefined,
  locale: Intl.LocalesArgument = 'es-PR',
) {
  const date = toSafeDate(input);

  if (!date) {
    return 'Fecha no disponible';
  }

  const formattedDate = formatAppointmentDate(date, locale);
  const formattedTime = formatAppointmentTime(date, locale);

  return `${formattedDate} · ${formattedTime}`;
}

export function formatLabDate(
  input: string | Date | null | undefined,
  locale: Intl.LocalesArgument = 'es-PR',
) {
  const date = toSafeDate(input);

  if (!date) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function isFutureDate(input: string | Date | null | undefined) {
  const date = toSafeDate(input);

  if (!date) {
    return false;
  }

  return date.getTime() > Date.now();
}

export function isPastDate(input: string | Date | null | undefined) {
  const date = toSafeDate(input);

  if (!date) {
    return false;
  }

  return date.getTime() < Date.now();
}

export function buildStartsAt(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const startsAt = new Date(`${date}T${time}`);

  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  return startsAt.toISOString();
}

export function splitStartsAt(input: string | Date | null | undefined) {
  const date = toSafeDate(input);

  if (!date) {
    return {
      date: '',
      time: '',
    };
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}
