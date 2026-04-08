import createDebug from "debug";

export var log = {
  server: createDebug("lattice:server"),
  ws: createDebug("lattice:ws"),
  chat: createDebug("lattice:chat"),
  session: createDebug("lattice:session"),
  mesh: createDebug("lattice:mesh"),
  meshConnect: createDebug("lattice:mesh:connect"),
  meshHello: createDebug("lattice:mesh:hello"),
  meshProxy: createDebug("lattice:mesh:proxy"),
  router: createDebug("lattice:router"),
  broadcast: createDebug("lattice:broadcast"),
  auth: createDebug("lattice:auth"),
  fs: createDebug("lattice:fs"),
  analytics: createDebug("lattice:analytics"),
  plugins: createDebug("lattice:plugins"),
  update: createDebug("lattice:update"),
  terminal: createDebug("lattice:terminal"),
  settings: createDebug("lattice:settings"),
  superpowers: createDebug("lattice:superpowers"),
};
