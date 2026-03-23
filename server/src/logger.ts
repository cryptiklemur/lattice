import createDebug from "debug";

export var log = {
  server: createDebug("lattice:server"),
  ws: createDebug("lattice:ws"),
  chat: createDebug("lattice:chat"),
  session: createDebug("lattice:session"),
  mesh: createDebug("lattice:mesh"),
  auth: createDebug("lattice:auth"),
  fs: createDebug("lattice:fs"),
  analytics: createDebug("lattice:analytics"),
};
