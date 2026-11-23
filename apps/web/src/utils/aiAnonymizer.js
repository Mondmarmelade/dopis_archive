/**
 * Utility to detect and redact Personally Identifiable Information (PII)
 * such as Email Addresses, IBANs, Credit Cards, Phone Numbers, IP Addresses, and Physical Addresses
 * before sending content to AI models.
 */
export function anonymizePii(text) {
  if (!text || typeof text !== "string") return "";

  let sanitized = text;

  // 1. E-Mail addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );

  // 2. IBANs (e.g. DE89 3704 0044 0532 0130 00)
  sanitized = sanitized.replace(
    /\b[A-Z]{2}[0-9]{2}(?:\s?[0-9A-Z]{4}){3,7}\b/gi,
    "[IBAN]"
  );

  // 3. Credit Card Numbers (e.g. 4111 2222 3333 4444)
  sanitized = sanitized.replace(
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    "[KREDITKARTE]"
  );

  // 4. German / European Street Addresses (e.g. Musterstraße 12a, Hauptstr. 5)
  sanitized = sanitized.replace(
    /\b([A-ZÄÖÜa-zäöüß]+(?:straße|strasse|str\.|weg|gasse|platz|allee|ring|chaussee)\s+[0-9]{1,4}\s*[a-zA-Z]?)\b/gi,
    "[STRASSE]"
  );

  // 5. Postal Codes with City (e.g. 10115 Berlin, D-80331 München)
  sanitized = sanitized.replace(
    /\b(?:D-|DE-)?([0-9]{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/g,
    "[PLZ ORT]"
  );

  // 6. Phone Numbers (e.g. +49 170 1234567, 030 / 123456, 0171-9876543, Tel: 089 123456)
  // Carefully avoids redacting order numbers (e.g. 302-1234567-8901234), DHL tracking IDs, or dates.
  sanitized = sanitized.replace(
    /(?:(?:\b(?:Tel(?:efon)?|Phone|Mobil|Mobile|Fax|Hotline|Rufnummer)\.?\s*[:\-]?\s*)|(?:\+|00)[1-9][0-9]{0,2}[\s\-./]?|\(?0[1-9][0-9]{1,4}\)?[\s\-/])(?:\(?[0-9]{1,5}\)?[\s\-./]?){1,4}[0-9]{2,6}\b/gi,
    (match) => {
      // Never redact ISO dates, timestamps, or 3-part Amazon-style order numbers (e.g. 302-1234567-8901234)
      if (
        match.includes(":") && !/^(?:Tel|Phone|Mobil|Mobile|Fax|Hotline|Rufnummer)/i.test(match)
      ) {
        return match;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(match.trim())) {
        return match;
      }
      if (/^\d{3}-\d{7}-\d{7}$/.test(match.trim())) {
        return match;
      }
      const digitsOnly = match.replace(/\D/g, "");
      if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
        const labelMatch = match.match(/^((?:Tel(?:efon)?|Phone|Mobil|Mobile|Fax|Hotline|Rufnummer)\.?\s*[:\-]?\s*)/i);
        return labelMatch ? `${labelMatch[1]}[TELEFON]` : "[TELEFON]";
      }
      return match;
    }
  );

  // 7. IPv4 Addresses (e.g. 192.168.1.1)
  sanitized = sanitized.replace(
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    "[IP-ADRESSE]"
  );

  return sanitized;
}
