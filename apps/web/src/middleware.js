import { defineMiddleware } from "astro/middleware";
import { handleOptions, isTokenValid } from "./utils/authHelper";
import { decryptData } from "./utils/cryptography";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Handle CORS preflight for all API routes
  if (context.request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return handleOptions();
  }

  // API endpoints manage their own authentication (Bearer token or cookie)
  if (pathname.startsWith("/api/")) {
    return next();
  }

  const authCookie = context.cookies.get("auth");
  let isAuthenticated = false;

  if (authCookie && authCookie.value) {
    try {
      const decrypted = decryptData(authCookie.value);
      if (isTokenValid(decrypted)) {
        isAuthenticated = true;
      } else {
        // Cookie token is invalid or was issued before a reset epoch
        context.cookies.delete("auth", { path: "/" });
      }
    } catch {
      context.cookies.delete("auth", { path: "/" });
    }
  }

  // If not logged in and not on login page -> go to login page
  if (!isAuthenticated && pathname !== "/login") {
    return context.redirect(authCookie ? "/login?reset=1" : "/login");
  }

  // If on login page and already logged in -> go to index page
  if (isAuthenticated && pathname === "/login") {
    return context.redirect("/");
  }

  const response = await next();

  // Inject defense-in-depth security headers
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
});
