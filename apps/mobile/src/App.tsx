'background only';

import { useState } from "@lynx-js/react";
import { DopisApiClient } from "@dopis/shared";
import { ServerLoginScreen } from "./screens/ServerLoginScreen.js";
import { MailboxScreen } from "./screens/MailboxScreen.js";
import { EmailDetailScreen } from "./screens/EmailDetailScreen.js";

type ScreenName = "login" | "inbox" | "detail";

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("login");
  const [apiClient, setApiClient] = useState<DopisApiClient | null>(null);
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("inbox");

  const handleLoginSuccess = (
    client: DopisApiClient,
    token: string,
    _serverUrl: string,
    email: string
  ) => {
    setApiClient(client);
    setAccountEmail(email);
    setCurrentScreen("inbox");
  };

  const handleSelectEmail = (id: string, folder: string) => {
    setSelectedEmailId(id);
    setSelectedFolder(folder);
    setCurrentScreen("detail");
  };

  const handleLogout = () => {
    setApiClient(null);
    setAccountEmail("");
    setSelectedEmailId(null);
    setCurrentScreen("login");
  };

  return (
    <view style={styles.root}>
      {currentScreen === "login" && (
        <ServerLoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {currentScreen === "inbox" && apiClient && (
        <MailboxScreen
          client={apiClient}
          accountEmail={accountEmail}
          onSelectEmail={handleSelectEmail}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === "detail" && apiClient && selectedEmailId && (
        <EmailDetailScreen
          client={apiClient}
          emailId={selectedEmailId}
          folder={selectedFolder}
          onBack={() => setCurrentScreen("inbox")}
        />
      )}
    </view>
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: "#f8fafc",
  },
};
