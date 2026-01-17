// Sample TypeScript file for testing SCIP parsing

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export class SimpleLogger implements Logger {
  info(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }
}

export function createLogger(): Logger {
  return new SimpleLogger();
}

export type LogLevel = "info" | "warn" | "error";

export const DEFAULT_LOG_LEVEL: LogLevel = "info";
