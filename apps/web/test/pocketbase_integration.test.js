import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

test("1. Docker Compose Configuration Integrity", () => {
  const composePath = path.join(rootDir, "docker-compose.yml");
  assert.ok(fs.existsSync(composePath), "docker-compose.yml must exist");
  const content = fs.readFileSync(composePath, "utf-8");
  assert.ok(content.includes("pocketbase"), "docker-compose must define pocketbase service");
  assert.ok(content.includes("8090:8090"), "pocketbase port 8090 must be mapped");
  assert.ok(content.includes("./pb_data:/pb_data"), "volume pb_data must be configured");
  assert.ok(content.includes("./pb_migrations:/pb_migrations"), "volume pb_migrations must be configured");
});

test("2. PocketBase Schema Migration Integrity", () => {
  const migrationPath = path.join(rootDir, "pb_migrations/1727800000_init_schema.js");
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
  const content = fs.readFileSync(migrationPath, "utf-8");
  assert.ok(content.includes('"orders"'), "Schema must define orders collection");
  assert.ok(content.includes('"receipts"'), "Schema must define receipts collection");
  assert.ok(content.includes('"email_records"'), "Schema must define email_records collection");
  assert.ok(content.includes('"tracking_number"'), "orders collection must have tracking_number field");
  assert.ok(content.includes('"file"'), "receipts collection must have file field");

  const aiMigrationPath = path.join(rootDir, "pb_migrations/1795000000_add_ai_analysis_to_email_records.js");
  assert.ok(fs.existsSync(aiMigrationPath), "AI fields migration file must exist");
  const aiMigContent = fs.readFileSync(aiMigrationPath, "utf-8");
  assert.ok(aiMigContent.includes('"ai_category"'), "AI migration must define ai_category");
  assert.ok(aiMigContent.includes('"ai_confidence"'), "AI migration must define ai_confidence");
  assert.ok(aiMigContent.includes('"ai_analysis"'), "AI migration must define ai_analysis");
  assert.ok(aiMigContent.includes('"header_signals"'), "AI migration must define header_signals");
});

test("3. PocketBase Client Module & Offline Resilience", async () => {
  const { getPocketBaseUrl, getReceiptFileUrl, isPocketBaseAvailable } = await import(
    "../src/lib/pocketbase.ts"
  );

  const url = getPocketBaseUrl();
  assert.ok(url.includes("8090") || url.startsWith("http"), "PB URL should be configured");

  const fileUrl = getReceiptFileUrl({
    id: "rec123",
    file: "invoice.pdf",
    user_email: "test@example.com",
  });
  assert.ok(fileUrl.includes("/api/files/receipts/rec123/invoice.pdf"), "Receipt file URL must match PB structure");

  // When PB is not running, isPocketBaseAvailable should safely return false without throwing
  const available = await isPocketBaseAvailable();
  assert.equal(typeof available, "boolean");
});

test("4. Order & Receipt Sync Engine Graceful Handling", async () => {
  const { syncAnalysisToPocketBase, getUserOrders, getUserReceipts } = await import(
    "../src/lib/orderReceiptSync.ts"
  );

  // Missing email test
  const missingEmailRes = await syncAnalysisToPocketBase({
    userEmail: "",
    mailSeq: 1,
    analysis: {
      summary: [],
      category: "Test",
      tags: [],
      actionItems: [],
      timestamp: Date.now(),
    },
  });
  assert.equal(missingEmailRes.synced, false);
  assert.ok(missingEmailRes.message.includes("Missing user email"));

  // Fetch when offline should return empty array safely without crash
  const orders = await getUserOrders("test@example.com");
  assert.ok(Array.isArray(orders));

  const receipts = await getUserReceipts("test@example.com");
  assert.ok(Array.isArray(receipts));
});

test("5. API Route Handlers Auth Protection", async () => {
  const ordersApi = await import("../src/pages/api/orders/index.js");
  const receiptsApi = await import("../src/pages/api/receipts/index.js");
  const linkApi = await import("../src/pages/api/orders/link.js");

  // Simulate unauthenticated request
  const unauthRequest = new Request("http://localhost:4321/api/orders");
  const unauthRes = await ordersApi.GET({ request: unauthRequest, cookies: {} });
  assert.equal(unauthRes.status, 401, "Orders GET should require authentication");

  const unauthReceiptsRes = await receiptsApi.GET({ request: unauthRequest, cookies: {} });
  assert.equal(unauthReceiptsRes.status, 401, "Receipts GET should require authentication");

  const unauthLinkRes = await linkApi.POST({ request: unauthRequest, cookies: {} });
  assert.equal(unauthLinkRes.status, 401, "Link POST should require authentication");
});

test("6. AI Analysis Extraction & Payload Mapping", async () => {
  const { syncAnalysisToPocketBase } = await import("../src/lib/orderReceiptSync.ts");

  // When PB server is unreachable, syncAnalysisToPocketBase returns gracefully without throwing
  const result = await syncAnalysisToPocketBase({
    userEmail: "nico@mondmarmelade.com",
    mailSeq: 1042,
    mailFolder: "inbox",
    mailSubject: "Ihre Bestellung bei Amazon.de #302-1234567-8901234",
    senderEmail: "auto-confirm@amazon.de",
    senderName: "Amazon.de",
    mailDate: new Date().toISOString(),
    analysis: {
      summary: ["Bestellbestätigung von Amazon"],
      category: "Bestellung",
      tags: ["amazon", "bestellung", "rechnung"],
      actionItems: [],
      orderInfo: {
        isOrder: true,
        merchant: "Amazon.de",
        orderId: "302-1234567-8901234",
        trackingNumber: "0034043423423423",
        carrier: "DHL",
        amount: "59,99 €",
        stage: "shipped",
        statusTitle: "Paket wurde versandt",
      },
      paymentInfo: {
        isPaymentReceipt: true,
        provider: "Visa",
        paidTo: "Amazon EU S.a.r.l.",
        amount: "59,99 €",
        transactionId: "TX-AMZN-998877",
      },
      timestamp: Date.now(),
    },
  });

  const { isPocketBaseAvailable } = await import("../src/lib/pocketbase.ts");
  const pbAvailable = await isPocketBaseAvailable();

  if (pbAvailable) {
    assert.equal(result.synced, true);
    assert.ok(result.order, "Order record must be created in PocketBase");
    assert.equal(result.order.merchant, "Amazon.de");
    assert.equal(result.order.order_number, "302-1234567-8901234");
  } else {
    assert.equal(result.synced, false);
    assert.ok(
      result.message.toLowerCase().includes("pocketbase") ||
      result.message.toLowerCase().includes("unreachable") ||
      result.message.toLowerCase().includes("offline")
    );
  }
});

test("7. IMAP Sync Engine State Tracking & Local Queries", async () => {
  const { getSyncState, updateSyncState, getLocalEmailsCount, getLocalEmails } = await import(
    "../src/lib/imapSyncEngine.ts"
  );

  const initial = getSyncState("test@example.com", "inbox");
  assert.equal(initial.isSyncing, false);
  assert.equal(initial.folder, "inbox");

  const updated = updateSyncState("test@example.com", "inbox", {
    isSyncing: true,
    total: 50,
    current: 12,
    message: "Importiere E-Mails: 12 / 50...",
  });
  assert.equal(updated.isSyncing, true);
  assert.equal(updated.current, 12);
  assert.equal(updated.total, 50);

  // Reset
  updateSyncState("test@example.com", "inbox", { isSyncing: false, current: 0 });

  const count = await getLocalEmailsCount("test@example.com", "inbox");
  assert.equal(typeof count, "number");

  const emails = await getLocalEmails("test@example.com", "inbox");
  assert.ok(Array.isArray(emails));
});

test("8. Sync API Endpoint Auth & Response Validation", async () => {
  const syncApi = await import("../src/pages/api/sync/index.js");

  const unauthRequest = new Request("http://localhost:4321/api/sync?folder=inbox");
  const unauthRes = await syncApi.GET({ request: unauthRequest, cookies: {} });
  assert.equal(unauthRes.status, 401, "Sync GET must require auth");

  const unauthPostRes = await syncApi.POST({ request: unauthRequest, cookies: {} });
  assert.equal(unauthPostRes.status, 401, "Sync POST must require auth");
});

test("9. Initial Sync Screen Layout Flash Prevention & SSR State Integrity", async () => {
  // 1. Verify mails.astro SSR server-side check
  const mailsAstroPath = path.join(rootDir, "apps/web/src/pages/mails.astro");
  assert.ok(fs.existsSync(mailsAstroPath), "mails.astro must exist");
  const mailsAstroContent = fs.readFileSync(mailsAstroPath, "utf-8");
  assert.ok(mailsAstroContent.includes("getLocalEmailsCount"), "mails.astro must check local emails count on server");
  assert.ok(mailsAstroContent.includes("getSyncState"), "mails.astro must check sync state on server");
  assert.ok(mailsAstroContent.includes("initialSyncNeeded={needsInitialSync}"), "mails.astro must pass initialSyncNeeded to Mail component");

  // 2. Verify Mail.jsx handles initialSyncNeeded prop
  const mailJsxPath = path.join(rootDir, "apps/web/src/components/Mail.jsx");
  assert.ok(fs.existsSync(mailJsxPath), "Mail.jsx must exist");
  const mailJsxContent = fs.readFileSync(mailJsxPath, "utf-8");
  assert.ok(mailJsxContent.includes("initialSyncNeeded"), "Mail.jsx must accept initialSyncNeeded prop");
  assert.ok(mailJsxContent.includes("InitialSyncScreen"), "Mail.jsx must render InitialSyncScreen when sync is needed");

  // 3. Verify sync engine logic for fresh database
  const { getLocalEmailsCount, getSyncState, updateSyncState } = await import(
    "../src/lib/imapSyncEngine.ts"
  );
  const state = getSyncState("newuser@example.com", "inbox");
  const count = await getLocalEmailsCount("newuser@example.com", "inbox");
  const needsSync = state.isSyncing || (count === 0 && !state.lastSyncTime);
  assert.equal(needsSync, true, "Fresh database with 0 emails must trigger initial sync without flashing layout");
});

test("10. Animated Conveyor Belt Sync Stream & Recent Emails Tracking", async () => {
  const { updateSyncState, getSyncState } = await import("../src/lib/imapSyncEngine.ts");

  // Verify recentEmails buffer tracking in imapSyncEngine
  updateSyncState("streamuser@example.com", "inbox", {
    isSyncing: true,
    recentEmails: [
      {
        seq: 101,
        subject: "Bestellbestätigung IKEA",
        senderName: "IKEA Deutschland",
        senderEmail: "kontakt@ikea.de",
        date: new Date().toISOString(),
        snippet: "Vielen Dank für Ihre Bestellung #12345...",
        hasAttachments: true,
      },
      {
        seq: 102,
        subject: "Dein wöchentlicher Newsletter",
        senderName: "Tech Digest",
        senderEmail: "news@techdigest.com",
        date: new Date().toISOString(),
        snippet: "Hier sind die wichtigsten Tech-News...",
        hasAttachments: false,
      },
    ],
  });

  const updatedState = getSyncState("streamuser@example.com", "inbox");
  assert.equal(updatedState.recentEmails.length, 2);
  assert.equal(updatedState.recentEmails[0].subject, "Bestellbestätigung IKEA");
  assert.equal(updatedState.recentEmails[0].hasAttachments, true);
  assert.equal(updatedState.recentEmails[1].senderName, "Tech Digest");

  // Verify InitialSyncScreen file integrity
  const screenPath = path.join(rootDir, "apps/web/src/components/mail/InitialSyncScreen.jsx");
  assert.ok(fs.existsSync(screenPath), "InitialSyncScreen.jsx must exist");
  const screenContent = fs.readFileSync(screenPath, "utf-8");
  assert.ok(screenContent.includes("feedQueue"), "Must use queue for conveyor belt feed");
  assert.ok(screenContent.includes("displayedCards"), "Must display active cards on conveyor belt");
  assert.ok(screenContent.includes("SenderAvatar"), "Must render SenderAvatar on conveyor cards");
  assert.ok(screenContent.includes("maskImage"), "Must apply gradient fade mask to conveyor belt");
  assert.ok(screenContent.includes("CheckCircle2"), "Must show completion checkmark on finish");
  assert.ok(screenContent.includes("rotateZ"), "Must apply inward rotation tilt to the vertical card stream");
  assert.ok(screenContent.includes("flex-col"), "Must use vertical layout for upward card stream");
});

test("11. Mobbin UX & User Guidance Overhaul Integrity (Command Palette, Shortcuts, Undo & Empty States)", () => {
  // 1. Verify existence and content of new UX components
  const cmdPalettePath = path.join(rootDir, "apps/web/src/components/mail/CommandPalette.jsx");
  assert.ok(fs.existsSync(cmdPalettePath), "CommandPalette.jsx must exist");
  const cmdPaletteContent = fs.readFileSync(cmdPalettePath, "utf-8");
  assert.ok(cmdPaletteContent.includes("CommandPalette"), "Must export CommandPalette");
  assert.ok(cmdPaletteContent.includes("⌘K") || cmdPaletteContent.includes("Strg+K") || cmdPaletteContent.includes("Command"), "Must handle command palette search");
  assert.ok(cmdPaletteContent.includes("executeCommand"), "Must execute commands on select");

  const shortcutsModalPath = path.join(rootDir, "apps/web/src/components/mail/KeyboardShortcutsModal.jsx");
  assert.ok(fs.existsSync(shortcutsModalPath), "KeyboardShortcutsModal.jsx must exist");
  const shortcutsContent = fs.readFileSync(shortcutsModalPath, "utf-8");
  assert.ok(shortcutsContent.includes("KeyboardShortcutsModal"), "Must export KeyboardShortcutsModal");
  assert.ok(shortcutsContent.includes("shortcutGroups"), "Must group shortcuts logically");
  assert.ok(shortcutsContent.includes("<kbd"), "Must render kbd key badges");

  const toastPath = path.join(rootDir, "apps/web/src/components/mail/ActionToast.jsx");
  assert.ok(fs.existsSync(toastPath), "ActionToast.jsx must exist");
  const toastContent = fs.readFileSync(toastPath, "utf-8");
  assert.ok(toastContent.includes("ActionToast"), "Must export ActionToast");
  assert.ok(toastContent.includes("Rückgängig"), "Must render Undo button");
  assert.ok(toastContent.includes("onUndo"), "Must support onUndo handler");

  const tipsBarPath = path.join(rootDir, "apps/web/src/components/mail/QuickTipsBar.jsx");
  assert.ok(fs.existsSync(tipsBarPath), "QuickTipsBar.jsx must exist");
  const tipsBarContent = fs.readFileSync(tipsBarPath, "utf-8");
  assert.ok(tipsBarContent.includes("QuickTipsBar"), "Must export QuickTipsBar");
  assert.ok(tipsBarContent.includes("dopis_dismissed_quick_tips"), "Must persist dismiss state in localStorage");

  // 2. Verify MailList empty states and visual selection markers
  const mailListPath = path.join(rootDir, "apps/web/src/components/mail/MailList.jsx");
  const mailListContent = fs.readFileSync(mailListPath, "utf-8");
  assert.ok(mailListContent.includes("Posteingang null"), "Must have Inbox Zero celebration empty state");
  assert.ok(mailListContent.includes("Suchfilter zurücksetzen"), "Must offer reset search button when no matches");
  assert.ok(mailListContent.includes("Archiv ist leer"), "Must have contextual archive empty state");
  assert.ok(mailListContent.includes("border-l-primary"), "Must highlight selected mail with left accent bar");
  assert.ok(mailListContent.includes("mail-item-"), "Must have mail-item ID for keyboard scroll target");

  // 3. Verify MailDisplay unselected guide state and shortcut tooltips
  const mailDisplayPath = path.join(rootDir, "apps/web/src/components/mail/MailDisplay.jsx");
  const mailDisplayContent = fs.readFileSync(mailDisplayPath, "utf-8");
  assert.ok(mailDisplayContent.includes("Keine E-Mail ausgewählt"), "Must render unselected state");
  assert.ok(mailDisplayContent.includes("Archivieren (E)"), "Must include shortcut hint in Archive tooltip");
  assert.ok(mailDisplayContent.includes("In den Papierkorb (Entf)"), "Must include shortcut hint in Trash tooltip");
  assert.ok(mailDisplayContent.includes("Tastaturkürzel (?)"), "Must include shortcut help button");

  // 4. Verify Mail.jsx global keydown handler and wiring
  const mailPath = path.join(rootDir, "apps/web/src/components/Mail.jsx");
  const mailContent = fs.readFileSync(mailPath, "utf-8");
  assert.ok(mailContent.includes("handleGlobalKeyDown"), "Must register global keydown listener");
  assert.ok(mailContent.includes("handleNavigateNext"), "Must implement J / ArrowDown keyboard navigation");
  assert.ok(mailContent.includes("handleNavigatePrev"), "Must implement K / ArrowUp keyboard navigation");
  assert.ok(mailContent.includes("handleUndo"), "Must implement Undo action handler");
  assert.ok(mailContent.includes("<CommandPalette"), "Must render CommandPalette overlay");
  assert.ok(mailContent.includes("<KeyboardShortcutsModal"), "Must render KeyboardShortcutsModal overlay");
  assert.ok(mailContent.includes("<ActionToast"), "Must render ActionToast overlay");
  assert.ok(mailContent.includes("<QuickTipsBar"), "Must render QuickTipsBar");
});

test("12. Fresh Install, Dev Reset & AI Setup Onboarding Integrity", async () => {
  // 1. Verify scripts/dev.ps1 reset flag logic
  const devScriptPath = path.join(rootDir, "scripts/dev.ps1");
  assert.ok(fs.existsSync(devScriptPath), "dev.ps1 must exist");
  const devScriptContent = fs.readFileSync(devScriptPath, "utf-8");
  assert.ok(devScriptContent.includes(".install_reset"), "dev.ps1 must touch .install_reset on -Reset");

  // 2. Verify authHelper.js reset epoch tracking & token invalidation
  const { getResetEpoch, setResetEpoch, isTokenValid } = await import(
    "../src/utils/authHelper.js"
  );
  assert.equal(typeof getResetEpoch, "function", "getResetEpoch must be exported");
  assert.equal(typeof setResetEpoch, "function", "setResetEpoch must be exported");
  assert.equal(typeof isTokenValid, "function", "isTokenValid must be exported");

  const currentEpoch = getResetEpoch();
  assert.ok(typeof currentEpoch === "number", "getResetEpoch must return a number");

  const testNewEpoch = Date.now() + 10000;
  setResetEpoch(testNewEpoch);
  assert.equal(getResetEpoch(), testNewEpoch, "setResetEpoch must persist epoch");

  // An old token issued before reset epoch should now be invalid
  const oldToken = [
    { user: "alice@test.de" },
    { pass: "secret" },
    { host: "imap.example.com" },
    { port: "993" },
    { iat: testNewEpoch - 5000 },
  ];
  assert.equal(isTokenValid(oldToken), false, "Token issued before reset epoch must be invalid");

  // A fresh token issued at or after reset epoch should be valid
  const freshToken = [
    { user: "alice@test.de" },
    { pass: "secret" },
    { host: "imap.example.com" },
    { port: "993" },
    { iat: testNewEpoch + 5000 },
  ];
  assert.equal(isTokenValid(freshToken), true, "Token issued after reset epoch must be valid");

  // Reset epoch back to 0 or current
  setResetEpoch(0);

  // 3. Verify /api/ai/models endpoint
  const modelsApiPath = path.join(rootDir, "apps/web/src/pages/api/ai/models.js");
  assert.ok(fs.existsSync(modelsApiPath), "pages/api/ai/models.js must exist");
  const { POST: handleModelsPost } = await import("../src/pages/api/ai/models.js");
  assert.equal(typeof handleModelsPost, "function", "models.js must export POST handler");

  // Rejects invalid URL
  const badReq = new Request("http://localhost:4321/api/ai/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: "invalid://url" }),
  });
  const badRes = await handleModelsPost({ request: badReq, cookies: { get: () => null } });
  assert.equal(badRes.status, 400, "Must return 400 for invalid/disallowed baseUrl");

  // 4. Verify login.astro setup UI elements
  const loginPath = path.join(rootDir, "apps/web/src/pages/login.astro");
  assert.ok(fs.existsSync(loginPath), "login.astro must exist");
  const loginContent = fs.readFileSync(loginPath, "utf-8");
  assert.ok(loginContent.includes("ai_base_url"), "login.astro must have ai_base_url input");
  assert.ok(loginContent.includes("ai_model"), "login.astro must have ai_model selector");
  assert.ok(loginContent.includes("fetch-models-btn"), "login.astro must have fetch-models-btn");
  assert.ok(loginContent.includes("test-connection-btn"), "login.astro must have test-connection-btn");
  assert.ok(loginContent.includes("dopis:ai:settings"), "login.astro must persist settings to dopis:ai:settings");
  assert.ok(loginContent.includes("dopis:saved_login"), "login.astro must persist and restore dopis:saved_login");
  assert.ok(loginContent.includes("reset=1"), "login.astro must handle ?reset=1 fresh install param");
  assert.ok(loginContent.includes("localStorage.clear()"), "login.astro must clear localStorage on reset");

  // 5. Verify SettingsForm.jsx hard reset button
  const settingsFormPath = path.join(rootDir, "apps/web/src/components/SettingsForm.jsx");
  const settingsContent = fs.readFileSync(settingsFormPath, "utf-8");
  assert.ok(settingsContent.includes("handleHardReset"), "SettingsForm must implement handleHardReset");
  assert.ok(settingsContent.includes("/logout?reset=1"), "SettingsForm must navigate to /logout?reset=1 on hard reset");
  assert.ok(settingsContent.includes("Auf Werkseinstellungen zurücksetzen"), "SettingsForm must label reset button");
  assert.ok(settingsContent.includes("dopis:saved_login"), "SettingsForm must preserve dopis:saved_login on hard reset");

  // 6. Verify setupStore.js for persistent setup across resets
  const { getSavedSetup, saveSetup } = await import("../src/utils/setupStore.js");
  assert.equal(typeof getSavedSetup, "function", "getSavedSetup must be exported");
  assert.equal(typeof saveSetup, "function", "saveSetup must be exported");
  const originalSetup = getSavedSetup();
  const testConfig = {
    user: "test-user@domain.de",
    pass: "supersecret",
    host: "imap.domain.de",
    port: "993",
    aiBaseUrl: "http://localhost:11434/v1",
    aiApiKey: "ollama",
    aiModel: "llama3.2",
  };
  try {
    saveSetup(testConfig);
    const loadedConfig = getSavedSetup();
    assert.equal(loadedConfig.user, "test-user@domain.de");
    assert.equal(loadedConfig.aiModel, "llama3.2");
  } finally {
    if (originalSetup && originalSetup.user) {
      saveSetup(originalSetup);
    }
  }
});



