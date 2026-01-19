// Logging utility using the debug library
// Control via DEBUG environment variable, e.g.:
//   DEBUG=dora:* dora index
//   DEBUG=dora:converter dora index
//   DEBUG=dora:index,dora:converter dora index

import createDebug from "debug";

// Create debug instances for different namespaces
export const debugIndex = createDebug("dora:index");
export const debugConverter = createDebug("dora:converter");
export const debugDb = createDebug("dora:db");
export const debugConfig = createDebug("dora:config");
export const debugScanner = createDebug("dora:scanner");
export const debugDocs = createDebug("dora:documents");

// For backwards compatibility, export common debug functions
export const debug = debugConverter;
export const info = debugConverter;
