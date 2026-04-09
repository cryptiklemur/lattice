import alabaster from "../../../themes/alabaster.json";
import amoled from "../../../themes/amoled.json";
import ayuLight from "../../../themes/ayu-light.json";
import catppuccinLatte from "../../../themes/catppuccin-latte.json";
import catppuccinMocha from "../../../themes/catppuccin-mocha.json";
import clayLight from "../../../themes/clay-light.json";
import clay from "../../../themes/clay.json";
import dracula from "../../../themes/dracula.json";
import everforestLight from "../../../themes/everforest-light.json";
import everforest from "../../../themes/everforest.json";
import githubLight from "../../../themes/github-light.json";
import gruvboxDark from "../../../themes/gruvbox-dark.json";
import gruvboxLight from "../../../themes/gruvbox-light.json";
import horizonLight from "../../../themes/horizon-light.json";
import kanagawaLotus from "../../../themes/kanagawa-lotus.json";
import kanagawa from "../../../themes/kanagawa.json";
import modusOperandi from "../../../themes/modus-operandi.json";
import monokai from "../../../themes/monokai.json";
import nightfox from "../../../themes/nightfox.json";
import nordLight from "../../../themes/nord-light.json";
import nord from "../../../themes/nord.json";
import oneDark from "../../../themes/one-dark.json";
import oneLight from "../../../themes/one-light.json";
import palenight from "../../../themes/palenight.json";
import paper from "../../../themes/paper.json";
import penumbraLight from "../../../themes/penumbra-light.json";
import poimandres from "../../../themes/poimandres.json";
import quietLight from "../../../themes/quiet-light.json";
import rosePineDawn from "../../../themes/rose-pine-dawn.json";
import rosePine from "../../../themes/rose-pine.json";
import solarizedDark from "../../../themes/solarized-dark.json";
import solarizedLight from "../../../themes/solarized-light.json";
import synthwave84 from "../../../themes/synthwave84.json";
import tokyoNightLight from "../../../themes/tokyo-night-light.json";
import tokyoNight from "../../../themes/tokyo-night.json";
import vesper from "../../../themes/vesper.json";

export interface ThemeColors {
  base00: string;
  base01: string;
  base02: string;
  base03: string;
  base04: string;
  base05: string;
  base06: string;
  base07: string;
  base08: string;
  base09: string;
  base0A: string;
  base0B: string;
  base0C: string;
  base0D: string;
  base0E: string;
  base0F: string;
}

export interface Theme extends ThemeColors {
  name: string;
  author: string;
  variant: "dark" | "light";
}

export interface ThemeEntry {
  id: string;
  theme: Theme;
}

export const themes: ThemeEntry[] = [
  { id: "alabaster", theme: alabaster as Theme },
  { id: "amoled", theme: amoled as Theme },
  { id: "ayu-light", theme: ayuLight as Theme },
  { id: "catppuccin-latte", theme: catppuccinLatte as Theme },
  { id: "catppuccin-mocha", theme: catppuccinMocha as Theme },
  { id: "clay-light", theme: clayLight as Theme },
  { id: "clay", theme: clay as Theme },
  { id: "dracula", theme: dracula as Theme },
  { id: "everforest-light", theme: everforestLight as Theme },
  { id: "everforest", theme: everforest as Theme },
  { id: "github-light", theme: githubLight as Theme },
  { id: "gruvbox-dark", theme: gruvboxDark as Theme },
  { id: "gruvbox-light", theme: gruvboxLight as Theme },
  { id: "horizon-light", theme: horizonLight as Theme },
  { id: "kanagawa-lotus", theme: kanagawaLotus as Theme },
  { id: "kanagawa", theme: kanagawa as Theme },
  { id: "modus-operandi", theme: modusOperandi as Theme },
  { id: "monokai", theme: monokai as Theme },
  { id: "nightfox", theme: nightfox as Theme },
  { id: "nord-light", theme: nordLight as Theme },
  { id: "nord", theme: nord as Theme },
  { id: "one-dark", theme: oneDark as Theme },
  { id: "one-light", theme: oneLight as Theme },
  { id: "palenight", theme: palenight as Theme },
  { id: "paper", theme: paper as Theme },
  { id: "penumbra-light", theme: penumbraLight as Theme },
  { id: "poimandres", theme: poimandres as Theme },
  { id: "quiet-light", theme: quietLight as Theme },
  { id: "rose-pine-dawn", theme: rosePineDawn as Theme },
  { id: "rose-pine", theme: rosePine as Theme },
  { id: "solarized-dark", theme: solarizedDark as Theme },
  { id: "solarized-light", theme: solarizedLight as Theme },
  { id: "synthwave84", theme: synthwave84 as Theme },
  { id: "tokyo-night-light", theme: tokyoNightLight as Theme },
  { id: "tokyo-night", theme: tokyoNight as Theme },
  { id: "vesper", theme: vesper as Theme },
];
