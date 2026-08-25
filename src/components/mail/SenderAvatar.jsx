import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { getAiSettings } from "@/lib/aiCache";

// Common personal webmail providers where domain logo is not sender's company/brand
const GENERIC_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.de",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "mail.de",
  "posteo.de",
]);

function getSenderDomain(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  return email.split("@")[1].toLowerCase().trim();
}

export function SenderAvatar({ email, size = "md", className }) {
  const [imgError, setImgError] = useState(false);
  const domain = getSenderDomain(email);

  const isGeneric = GENERIC_PROVIDERS.has(domain);
  const showLogo = domain && !isGeneric && !imgError;

  // If no valid brand domain or loading failed, render nothing (no fallback)
  if (!showLogo) {
    return null;
  }

  const sizeClasses =
    size === "lg"
      ? "h-10 w-10 min-w-[40px]"
      : size === "md"
      ? "h-8 w-8 min-w-[32px]"
      : "h-6 w-6 min-w-[24px]";

  const imgSize = size === "lg" ? 64 : size === "md" ? 48 : 32;

  // Retrieve Logo.dev token from settings or environment
  const settings = getAiSettings();
  const logoDevToken =
    settings.logoDevToken ||
    import.meta.env.PUBLIC_LOGO_DEV_TOKEN ||
    import.meta.env.LOGO_DEV_PUBLISHABLE_KEY ||
    "";

  // Build Logo.dev URL (with fallback to Google Favicons if no token provided)
  const logoUrl = logoDevToken
    ? `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(
        logoDevToken
      )}&size=${imgSize * 2}&format=webp`
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        domain
      )}&sz=${imgSize}`;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg overflow-hidden border bg-background/80 shadow-2xs",
        sizeClasses,
        className
      )}
    >
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setImgError(true)}
        className="h-full w-full object-contain p-1 rounded-md"
      />
    </div>
  );
}
