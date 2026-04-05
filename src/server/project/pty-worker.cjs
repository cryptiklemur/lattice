// Worker that runs node-pty in a subprocess, communicating via stdin/stdout JSON messages.
// Running node-pty in a separate process avoids SIGHUP issues with --watch mode.
var pty = require("node-pty");

var term = null;

process.stdin.setEncoding("utf-8");
var buffer = "";

process.stdin.on("data", function (chunk) {
  buffer += chunk;
  var lines = buffer.split("\n");
  buffer = lines.pop();
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      handleMessage(JSON.parse(lines[i]));
    } catch (e) {
      // ignore parse errors
    }
  }
});

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handleMessage(msg) {
  if (msg.type === "create") {
    var shell = process.env.SHELL || "bash";
    term = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: msg.cols || 80,
      rows: msg.rows || 24,
      cwd: msg.cwd || process.env.HOME,
      env: process.env,
    });

    term.onData(function (data) {
      send({ type: "data", data: data });
    });

    term.onExit(function (e) {
      send({ type: "exit", code: e.exitCode || 0 });
      process.exit(0);
    });

    send({ type: "ready", pid: term.pid });
  }

  if (msg.type === "input" && term) {
    term.write(msg.data);
  }

  if (msg.type === "resize" && term) {
    try {
      term.resize(msg.cols, msg.rows);
    } catch (e) {
      // ignore resize errors
    }
  }

  if (msg.type === "kill") {
    if (term) {
      try { term.kill(); } catch (e) { /* already dead */ }
    }
    process.exit(0);
  }
}

process.on("SIGTERM", function () {
  if (term) {
    try { term.kill(); } catch (e) { /* already dead */ }
  }
  process.exit(0);
});

process.on("SIGHUP", function () {
  if (term) {
    try { term.kill(); } catch (e) { /* already dead */ }
  }
  process.exit(0);
});
