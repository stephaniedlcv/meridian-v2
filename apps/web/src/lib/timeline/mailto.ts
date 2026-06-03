'use client';

import type { HealthEvent, LabDocument } from '@/types/database';
import { formatAppointmentDateTime, formatLabDate } from './dateFormat';

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join('\n');
}

function formatLabLine(lab: Pick<LabDocument, 'name' | 'lab_date' | 'specialty'>) {
  const parts = [
    lab.name,
    lab.lab_date ? formatLabDate(lab.lab_date) : null,
    lab.specialty,
  ].filter(Boolean);

  return `• ${parts.join(' · ')}`;
}

export function buildLabShareMailto(
  event: Pick<
    HealthEvent,
    'specialty' | 'provider_name' | 'starts_at' | 'reason'
  >,
  labs: Array<Pick<LabDocument, 'name' | 'lab_date' | 'specialty'>> = [],
) {
  const appointmentDateTime = formatAppointmentDateTime(event.starts_at);
  const subject = `Lab results for ${event.specialty} · ${appointmentDateTime}`;

  const labList =
    labs.length > 0
      ? labs.map(formatLabLine).join('\n')
      : 'No linked lab documents listed.';

  const body = compactLines([
    'Hi,',
    '',
    `I’m sharing the lab names related to my ${event.specialty} appointment on ${appointmentDateTime}.`,
    event.provider_name ? `Provider: ${event.provider_name}` : null,
    event.reason ? `Reason for visit: ${event.reason}` : null,
    '',
    'Linked labs:',
    labList,
    '',
    'Please let me know if you would like me to send the files separately.',
    '',
    'Thank you.',
  ]);

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
