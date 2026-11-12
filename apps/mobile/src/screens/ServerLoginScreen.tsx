'background only';

import { useState } from "@lynx-js/react";
import { DopisApiClient } from "@dopis/shared";
import logoSvg from "../assets/logo.svg";

interface ServerLoginScreenProps {
  onLoginSuccess: (client: DopisApiClient, token: string, serverUrl: string, email: string) => void;
}

export function ServerLoginScreen({ onLoginSuccess }: ServerLoginScreenProps) {
  const [serverUrl, setServerUrl] = useState("http://192.168.178.20:4321");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("imap.ionos.de");
  const [port, setPort] = useState("993");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Bitte Benutzername und Passwort eingeben.");
      return;
    }

    const imapHost = host.trim() || (email.includes("@") ? "imap." + email.split("@")[1] : "");
    if (!imapHost) {
      setErrorMessage("Bitte einen IMAP-Server angeben.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      let storedToken: string | null = null;
      const client = new DopisApiClient({
        baseUrl: serverUrl.trim() || "http://192.168.178.20:4321",
        getToken: () => storedToken,
      });

      const res = await client.login({
        email: email.trim(),
        password,
        host: imapHost,
        port: Number(port) || 993,
        secure: Number(port) === 993,
      });

      if (res.success && res.token) {
        storedToken = res.token;
        onLoginSuccess(client, res.token, serverUrl.trim(), email.trim());
      } else {
        setErrorMessage(
          res.error || "IMAP-Anmeldung fehlgeschlagen. Bitte prüfe E-Mail-Adresse, Passwort und Server-Einstellungen."
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Verbindungsfehler. Bitte prüfe die Server-Adresse und deine Netzwerkverbindung."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <view style={styles.container}>
      <view style={styles.formWrap}>
        {/* Dopis Logo */}
        <view style={styles.logoRow}>
          <image src={logoSvg} style={styles.logo} />
        </view>

        {/* Headline */}
        <text style={styles.headline}>IMAP-Zugangsdaten eingeben</text>

        {/* Error Banner */}
        {errorMessage ? (
          <view style={styles.errorBanner}>
            <text style={styles.errorText}>{errorMessage}</text>
          </view>
        ) : null}

        {/* Form Fields - 1:1 like login.astro */}
        <view style={styles.field}>
          <text style={styles.label}>Benutzername / E-Mail:</text>
          <input
            style={styles.input}
            type="email"
            placeholder="name@domain.de"
            placeholder-color="#9ca3af"
            value={email}
            bindinput={(e: any) => setEmail(e.detail.value)}
          />
        </view>

        <view style={styles.field}>
          <text style={styles.label}>Passwort:</text>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            placeholder-color="#94a3af"
            value={password}
            bindinput={(e: any) => setPassword(e.detail.value)}
          />
        </view>

        <view style={styles.field}>
          <text style={styles.label}>IMAP-Server (Host):</text>
          <input
            style={styles.input}
            placeholder="imap.ionos.de"
            placeholder-color="#9ca3af"
            value={host}
            bindinput={(e: any) => setHost(e.detail.value)}
          />
        </view>

        <view style={styles.field}>
          <text style={styles.label}>Port:</text>
          <input
            style={styles.input}
            type="number"
            placeholder="993"
            placeholder-color="#94a3af"
            value={port}
            bindinput={(e: any) => setPort(e.detail.value)}
          />
        </view>

        {/* Submit Button */}
        <view
          style={isLoading ? styles.buttonDisabled : styles.button}
          bindtap={isLoading ? undefined : handleLogin}
        >
          <text style={styles.buttonText}>
            {isLoading ? "Verbinde..." : "Mit Postfach verbinden"}
          </text>
        </view>

        {/* Optional Server Config Toggle (discreet) */}
        <view
          style={styles.serverToggle}
          bindtap={() => setShowServerConfig(!showServerConfig)}
        >
          <text style={styles.serverToggleText}>
            {showServerConfig ? "▲ Server-URL ausblenden" : "⚙ API-Server anpassen"}
          </text>
        </view>

        {showServerConfig ? (
          <view style={styles.serverConfigBox}>
            <text style={styles.serverConfigLabel}>Backend API-URL:</text>
            <input
              style={styles.serverConfigInput}
              placeholder="http://192.168.178.20:4321"
              placeholder-color="#9ca3af"
              value={serverUrl}
              bindinput={(e: any) => setServerUrl(e.detail.value)}
            />
          </view>
        ) : null}
      </view>
    </view>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  formWrap: {
    width: "100%",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logoRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "12px",
  },
  logo: {
    width: "130px",
    height: "54px",
  },
  headline: {
    margin: "0 0 15px 0",
    fontSize: "22px",
    fontWeight: "600",
    color: "#3661a4",
    textAlign: "center",
  },
  errorBanner: {
    width: "100%",
    backgroundColor: "#fee2e2",
    borderWidth: "1px",
    borderColor: "#f87171",
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#991b1b",
    fontSize: "13px",
    textAlign: "center",
  },
  field: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    marginTop: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "4px",
  },
  input: {
    width: "100%",
    height: "44px",
    borderWidth: "1px",
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
    paddingLeft: "12px",
    paddingRight: "12px",
    fontSize: "15px",
    color: "#111827",
  },
  button: {
    width: "100%",
    height: "46px",
    backgroundColor: "#3661a4",
    borderRadius: "6px",
    marginTop: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    width: "100%",
    height: "46px",
    backgroundColor: "#3661a4",
    opacity: 0.6,
    borderRadius: "6px",
    marginTop: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
  },
  serverToggle: {
    marginTop: "16px",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  serverToggleText: {
    fontSize: "12px",
    color: "#6b7280",
  },
  serverConfigBox: {
    width: "100%",
    marginTop: "10px",
    padding: "10px",
    backgroundColor: "#f9fafb",
    borderWidth: "1px",
    borderColor: "#e5e7eb",
    borderRadius: "6px",
  },
  serverConfigLabel: {
    fontSize: "11px",
    color: "#6b7280",
    marginBottom: "4px",
  },
  serverConfigInput: {
    width: "100%",
    height: "36px",
    backgroundColor: "#ffffff",
    borderWidth: "1px",
    borderColor: "#d1d5db",
    borderRadius: "4px",
    paddingLeft: "8px",
    paddingRight: "8px",
    fontSize: "12px",
    color: "#111827",
  },
};
