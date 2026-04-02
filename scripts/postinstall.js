var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var nmDir = path.join(root, "node_modules", "@lattice");

// Create workspace symlinks so @lattice/shared etc. resolve correctly
// This is needed because npm/bun global installs don't set up workspaces
try { fs.mkdirSync(nmDir, { recursive: true }); } catch {}

["shared", "server", "client"].forEach(function (pkg) {
  var target = path.join(nmDir, pkg);
  var source = path.join(root, pkg);
  if (!fs.existsSync(source)) return;
  try {
    fs.lstatSync(target);
  } catch {
    try {
      fs.symlinkSync(source, target, "junction");
    } catch {}
  }
});

// Also install server dependencies if node_modules doesn't exist
var serverNm = path.join(root, "server", "node_modules");
if (!fs.existsSync(serverNm)) {
  try {
    var { execSync } = require("child_process");
    execSync("bun install --frozen-lockfile", { cwd: root, stdio: "ignore", timeout: 30000 });
  } catch {}
}
