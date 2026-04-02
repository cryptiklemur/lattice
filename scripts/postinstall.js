var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var nmDir = path.join(root, "node_modules", "@lattice");

try { fs.mkdirSync(nmDir, { recursive: true }); } catch {}

["shared", "server", "client"].forEach(function (pkg) {
  var target = path.join(nmDir, pkg);
  var source = path.join(root, pkg);
  try {
    fs.lstatSync(target);
  } catch {
    try {
      fs.symlinkSync(source, target, "dir");
    } catch {}
  }
});
