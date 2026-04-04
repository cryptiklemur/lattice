export var IS_COMPILED = typeof Bun !== "undefined"
  && !process.argv[0].endsWith("/bun")
  && !process.argv[0].endsWith("\\bun.exe")
  && !process.argv[0].includes("node_modules");
