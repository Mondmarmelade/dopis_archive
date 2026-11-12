import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { getAiSettings } from "@/lib/aiCache";

// Common personal webmail providers where domain logo is not sender's company/brand
export const GENERIC_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.de",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "web.de",
  "t-online.de",
  "freenet.de",
  "1und1.de",
  "arcor.de",
  "vodafone.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "mail.de",
  "posteo.de",
  "mailbox.org",
  "aol.com",
  "zoho.com",
]);

export const AVATAR_COLORS = [
  "#2563eb", // blue (e.g. Jobwork, momox)
  "#78350f", // warm brown / amber-900 (like DIE ZEIT)
  "#0f766e", // deep teal / pine green (like Vinted)
  "#1d4ed8", // royal blue
  "#7c3aed", // violet
  "#b91c1c", // red
  "#c2410c", // orange
  "#047857", // emerald
  "#4338ca", // indigo
  "#a21caf", // fuchsia
  "#0369a1", // sky
];

export function getSenderDomain(email) {
  if (!email || typeof email !== "string") return "";
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match) return match[1].toLowerCase().trim();
  if (email.includes("@")) {
    return email.split("@").pop().replace(/[<>]/g, "").toLowerCase().trim();
  }
  return "";
}

export function getAvatarColor(nameOrEmail = "") {
  let hash = 0;
  for (let i = 0; i < nameOrEmail.length; i++) {
    hash = nameOrEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getSenderInitials(name = "", email = "") {
  const cleanName = (name || "").trim().replace(/[^\p{L}\p{N}\s]/gu, "");
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length > 0) {
    return words[0][0].toUpperCase();
  }
  if (email) {
    const user = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    return user.slice(0, 2).toUpperCase() || "?";
  }
  return "?";
}

export function SenderAvatar({
  email,
  name,
  initials,
  avatarBg,
  icon: FallbackIcon,
  size = "md",
  shape = "circle",
  className,
}) {
  const [imgError, setImgError] = useState(false);
  const domain = getSenderDomain(email);

  const isGeneric = GENERIC_PROVIDERS.has(domain);
  const canShowLogo = Boolean(domain && !isGeneric && !imgError);

  const fallbackInitials = initials || getSenderInitials(name, email);
  const fallbackBg = avatarBg || getAvatarColor(name || email);

  const sizeClasses =
    size === "lg"
      ? "h-10 w-10 min-w-[40px] text-sm"
      : size === "md"
      ? "h-8 w-8 min-w-[32px] text-xs"
      : "h-7 w-7 min-w-[28px] text-[11px]";

  const imgSize = size === "lg" ? 64 : size === "md" ? 48 : 32;

  const settings = getAiSettings();
  const logoDevToken =
    settings.logoDevToken ||
    import.meta.env.PUBLIC_LOGO_DEV_TOKEN ||
    import.meta.env.LOGO_DEV_PUBLISHABLE_KEY ||
    "";

  const logoUrl = domain
    ? logoDevToken
      ? `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(
          logoDevToken
        )}&size=${imgSize * 2}&format=webp`
      : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
          domain
        )}&sz=${imgSize * 2}`
    : "";

  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  if (canShowLogo) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-border/50 bg-white dark:bg-zinc-800 shadow-2xs select-none",
          sizeClasses,
          roundedClass,
          className
        )}
      >
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => setImgError(true)}
          className={cn(
            "h-full w-full object-contain",
            shape === "circle" ? "rounded-full p-0.5" : "rounded-md p-1"
          )}
        />
      </div>
    );
  }

  // Fallback: Colored circle or rounded box with Icon or Initials
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-white font-bold select-none shadow-2xs",
        sizeClasses,
        roundedClass,
        className
      )}
      style={{ backgroundColor: fallbackBg }}
    >
      {FallbackIcon ? (
        <FallbackIcon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : (
        fallbackInitials
      )}
    </div>
  );
}
