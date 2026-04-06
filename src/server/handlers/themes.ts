import { join } from "node:path";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import type {
  ClientMessage,
  ThemeSaveMessage,
  ThemeDeleteMessage,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { getLatticeHome } from "../config";

function themesDir(): string {
  return join(getLatticeHome(), "themes");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureThemesDir(): Promise<void> {
  await mkdir(themesDir(), { recursive: true });
}

async function loadAllThemes(): Promise<Array<{ name: string; author: string; variant: string; filename: string; colors: Record<string, string> }>> {
  await ensureThemesDir();
  var dir = themesDir();
  var files = await readdir(dir);
  var jsonFiles = files.filter((f) => f.endsWith(".json"));
  var themes: Array<{ name: string; author: string; variant: string; filename: string; colors: Record<string, string> }> = [];

  for (var file of jsonFiles) {
    try {
      var raw = await readFile(join(dir, file), "utf-8");
      var data = JSON.parse(raw);
      var colors: Record<string, string> = {};
      for (var key of Object.keys(data)) {
        if (key.startsWith("base0")) {
          colors[key] = data[key];
        }
      }
      themes.push({
        name: data.name ?? file.replace(/\.json$/, ""),
        author: data.author ?? "",
        variant: data.variant ?? "dark",
        filename: file,
        colors,
      });
    } catch {
      // skip malformed files
    }
  }

  return themes;
}

registerHandler("theme", async function (clientId: string, message: ClientMessage) {
  if (message.type === "theme:list_custom") {
    var themes = await loadAllThemes();
    sendTo(clientId, { type: "theme:custom_list", themes });
    return;
  }

  if (message.type === "theme:save") {
    var saveMsg = message as ThemeSaveMessage;
    var slug = slugify(saveMsg.name);
    var filename = slug + ".json";
    var themeData: Record<string, string> = {
      name: saveMsg.name,
      author: saveMsg.author,
      variant: saveMsg.variant,
      ...saveMsg.colors,
    };

    await ensureThemesDir();
    await writeFile(join(themesDir(), filename), JSON.stringify(themeData, null, 2));

    var savedColors: Record<string, string> = {};
    for (var key of Object.keys(saveMsg.colors)) {
      if (key.startsWith("base0")) {
        savedColors[key] = saveMsg.colors[key];
      }
    }

    sendTo(clientId, {
      type: "theme:saved",
      theme: {
        name: saveMsg.name,
        author: saveMsg.author,
        variant: saveMsg.variant,
        filename,
        colors: savedColors,
      },
    });

    var allThemes = await loadAllThemes();
    broadcast({ type: "theme:custom_list", themes: allThemes });
    return;
  }

  if (message.type === "theme:delete") {
    var deleteMsg = message as ThemeDeleteMessage;
    var deleteSlug = slugify(deleteMsg.name);
    var deleteFilename = deleteSlug + ".json";

    try {
      await unlink(join(themesDir(), deleteFilename));
    } catch {
      sendTo(clientId, { type: "chat:error", message: "Theme file not found" });
      return;
    }

    sendTo(clientId, { type: "theme:deleted", filename: deleteFilename });

    var updatedThemes = await loadAllThemes();
    broadcast({ type: "theme:custom_list", themes: updatedThemes });
    return;
  }
});
