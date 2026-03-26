import { chmodSync, renameSync, writeFileSync, accessSync, constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { checkForUpdate, getPackageName, getGitHubRepo, getInstallMode } from "../update-checker";
import { IS_COMPILED } from "../runtime";

function getAssetName(): string {
  var platform = process.platform === "darwin" ? "darwin" : "linux";
  var arch = process.arch === "arm64" ? "arm64" : "x64";
  return "lattice-" + platform + "-" + arch;
}

async function downloadBinaryUpdate(): Promise<{ success: boolean; message: string }> {
  var repo = getGitHubRepo();
  var assetName = getAssetName();

  try {
    var releaseRes = await fetch("https://api.github.com/repos/" + repo + "/releases/latest", {
      headers: { "Accept": "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(30000),
    });

    if (!releaseRes.ok) {
      return { success: false, message: "Failed to fetch release info (HTTP " + releaseRes.status + ")" };
    }

    var release = await releaseRes.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
    var assets = release.assets ?? [];
    var asset = assets.find(function (a) { return a.name === assetName; });

    if (!asset) {
      return { success: false, message: "No binary found for " + assetName + " in latest release" };
    }

    var downloadRes = await fetch(asset.browser_download_url, {
      signal: AbortSignal.timeout(120000),
    });

    if (!downloadRes.ok) {
      return { success: false, message: "Failed to download binary (HTTP " + downloadRes.status + ")" };
    }

    var binary = new Uint8Array(await downloadRes.arrayBuffer());
    var execPath = process.execPath;
    var tmpPath = join(tmpdir(), "lattice-update-" + Date.now());

    writeFileSync(tmpPath, binary);
    chmodSync(tmpPath, 0o755);

    var needsSudo = false;
    try {
      accessSync(execPath, fsConstants.W_OK);
    } catch {
      needsSudo = true;
    }

    if (needsSudo) {
      try {
        execSync("sudo mv " + JSON.stringify(tmpPath) + " " + JSON.stringify(execPath), { stdio: "pipe", timeout: 10000 });
        execSync("sudo chmod +x " + JSON.stringify(execPath), { stdio: "pipe", timeout: 5000 });
      } catch {
        return { success: false, message: "Update downloaded but needs sudo to install. Run: sudo mv " + tmpPath + " " + execPath };
      }
    } else {
      renameSync(tmpPath, execPath);
    }

    return { success: true, message: "Updated successfully. Restart the server to apply." };
  } catch (err) {
    return { success: false, message: "Update failed: " + (err instanceof Error ? err.message : String(err)) };
  }
}

registerHandler("update", function (clientId: string, message: ClientMessage) {
  if (message.type === "update:check") {
    var checkMsg = message as { type: "update:check"; force?: boolean };
    void checkForUpdate(checkMsg.force ?? false).then(function (info) {
      sendTo(clientId, {
        type: "update:status",
        currentVersion: info.currentVersion,
        latestVersion: info.latestVersion,
        updateAvailable: info.updateAvailable,
        releaseUrl: info.releaseUrl,
        installMode: info.installMode,
      });
    });
    return;
  }

  if (message.type === "update:apply") {
    if (IS_COMPILED) {
      void downloadBinaryUpdate().then(function (result) {
        sendTo(clientId, { type: "update:apply_result", success: result.success, message: result.message });
        if (result.success) {
          void checkForUpdate(true).then(function (info) {
            broadcast({
              type: "update:status",
              currentVersion: info.currentVersion,
              latestVersion: info.latestVersion,
              updateAvailable: info.updateAvailable,
              releaseUrl: info.releaseUrl,
              installMode: info.installMode,
            });
          });
        }
      });
    } else {
      var pkgName = getPackageName();
      try {
        var proc = Bun.spawn(["bun", "install", "-g", pkgName + "@latest"], {
          stdout: "pipe",
          stderr: "pipe",
        });

        var timeout = setTimeout(function () {
          proc.kill();
        }, 120000);

        void proc.exited.then(function (code) {
          clearTimeout(timeout);
          if (code === 0) {
            sendTo(clientId, { type: "update:apply_result", success: true, message: "Updated successfully. Restart the server to apply." });
            void checkForUpdate(true).then(function (info) {
              broadcast({
                type: "update:status",
                currentVersion: info.currentVersion,
                latestVersion: info.latestVersion,
                updateAvailable: info.updateAvailable,
                releaseUrl: info.releaseUrl,
                installMode: info.installMode,
              });
            });
          } else {
            sendTo(clientId, { type: "update:apply_result", success: false, message: "Update failed (exit code " + code + ")" });
          }
        });
      } catch (err) {
        sendTo(clientId, { type: "update:apply_result", success: false, message: "Failed to start update: " + String(err) });
      }
    }
    return;
  }
});
