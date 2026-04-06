#!/usr/bin/env node
var fs = require("fs");
var path = require("path");

function walk(dir) {
  var files = [];
  for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

var re = /(from\s+"|import\(\s*")(\.\.?\/[^"]+)(")/g;
var dirs = ["dist/server", "dist/shared"];
var files = [];
for (var d of dirs) {
  if (fs.existsSync(d)) files.push(...walk(d));
}

var count = 0;
for (var file of files) {
  var src = fs.readFileSync(file, "utf-8");
  var out = src.replace(re, function (m, pre, specifier, post) {
    if (specifier.endsWith(".js") || specifier.endsWith(".json")) return m;
    count++;
    return pre + specifier + ".js" + post;
  });
  if (out !== src) fs.writeFileSync(file, out);
}
