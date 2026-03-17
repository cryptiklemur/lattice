import { startDaemon } from "./daemon";

var args = process.argv.slice(2);
var command = args[0] || "daemon";

switch (command) {
  case "daemon":
    await startDaemon();
    break;
  case "stop":
    console.log("[lattice] Stop not yet implemented");
    process.exit(0);
    break;
  default:
    console.log(`[lattice] Unknown command: ${command}`);
    process.exit(1);
}
