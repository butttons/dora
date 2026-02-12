/**
 * Dora Extension - Minimal lifecycle hooks for dora CLI
 * 
 * This extension only handles session lifecycle:
 * - On session start: Check if dora is initialized
 * - On session shutdown: Background index update
 * 
 * The LLM uses regular `bash` tool to run dora commands.
 * See .dora/docs/SKILL.md for complete dora usage documentation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let doraAvailable = false;

  // Check dora status on session start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const check = await pi.exec("bash", ["-c", "command -v dora"], {
        timeout: 1000,
      });
      doraAvailable = check.code === 0;

      if (doraAvailable) {
        const status = await pi.exec("bash", ["-c", "dora status 2>/dev/null"], {
          timeout: 2000,
        });
        
        if (status.code !== 0) {
          ctx.ui.notify("dora not initialized. Run: dora init && dora index", "info");
        }
      }
    } catch (error) {
      doraAvailable = false;
    }
  });

  // Update index in background on shutdown
  pi.on("session_shutdown", async (_event, ctx) => {
    if (doraAvailable) {
      try {
        // Fire and forget background index update
        pi.exec("bash", ["-c", "(dora index > /tmp/dora-index.log 2>&1 &) || true"], {
          timeout: 500,
        }).catch(() => {
          // Ignore errors - this is best effort
        });
      } catch (error) {
        // Silent failure for background task
      }
    }
  });
}
