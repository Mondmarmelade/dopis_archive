import { defineConfig } from "@lynx-js/rspeedy";
import { pluginReactLynx } from "@lynx-js/react-rsbuild-plugin";
import qrcodeTerminal from "qrcode-terminal";

const qrcode = (qrcodeTerminal as any)?.default || qrcodeTerminal;

function pluginTerminalQRCode() {
  return {
    name: "terminal-qrcode",
    setup(api: any) {
      api.onAfterStartDevServer(async ({ environments, port }: any) => {
        try {
          const config = api.getNormalizedConfig();
          const assetPrefix = config?.dev?.assetPrefix || `http://localhost:${port}/`;
          const base = assetPrefix.replaceAll("<port>", String(port));
          const baseUrl = base.endsWith("/") ? base : `${base}/`;

          const entryNames = Object.keys(environments?.lynx?.entry ?? { main: "" });
          const entries = entryNames.length > 0 ? entryNames : ["main"];

          for (const entry of entries) {
            const bundleUrl = new URL(`${entry}.lynx.bundle`, baseUrl).toString();
            console.log("\n");
            console.log("  ╔════════════════════════════════════════════════════════╗");
            console.log("  ║             📱 Scan with Lynx Explorer                 ║");
            console.log("  ╚════════════════════════════════════════════════════════╝\n");
            qrcode.generate(bundleUrl, { small: true }, (qr: string) => {
              console.log(qr);
            });
            console.log(`\n  🔗 Lynx Bundle URL: ${bundleUrl}\n`);
          }
        } catch (err) {
          console.error("Failed to display Lynx QR code in terminal:", err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginTerminalQRCode(),
  ],
});

