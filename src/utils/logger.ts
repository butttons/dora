// Logging utility using the debug library
// Control via DEBUG environment variable, e.g.:
//   DEBUG=dora:* ctx index
//   DEBUG=dora:converter ctx index
//   DEBUG=dora:index,dora:converter ctx index

import createDebug from "debug";

// Create debug instances for different namespaces
export const debugIndex = createDebug("dora:index");
export const debugConverter = createDebug("dora:converter");
export const debugDb = createDebug("dora:db");
export const debugConfig = createDebug("dora:config");

// For backwards compatibility, export common debug functions
export const debug = debugConverter;
export const info = debugConverter;
