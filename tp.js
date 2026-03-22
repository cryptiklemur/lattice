var p = Bun.spawn(["bun", "run", "/home/aequasi/projects/cryptiklemur/lattice/server/src/project/pty-worker.js"], {
  stdin: "pipe", stdout: "pipe", stderr: "pipe", cwd: "/tmp"
});
async function readOut() {
  var d = new TextDecoder();
  var rd = p.stdout.getReader();
  while (true) { var x = await rd.read(); if (x.done) break; process.stdout.write("[OUT] " + d.decode(x.value)); }
}
async function readErr() {
  var d = new TextDecoder();
  var rd = p.stderr.getReader();
  while (true) { var x = await rd.read(); if (x.done) break; process.stderr.write("[ERR] " + d.decode(x.value)); }
}
readOut();
readErr();
p.stdin.write('{"type":"create","cwd":"/tmp"}\n');
setTimeout(function() { p.stdin.write('{"type":"input","data":"echo hello\\r"}\n'); }, 1000);
setTimeout(function() { p.stdin.write('{"type":"kill"}\n'); }, 3000);
setTimeout(function() { process.exit(); }, 4000);
