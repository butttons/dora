// Sample app file that imports from sample.ts

import {
	createLogger,
	DEFAULT_LOG_LEVEL,
	type Logger,
	type LogLevel,
} from "./sample";

export class Application {
	private logger: Logger;
	private logLevel: LogLevel;

	constructor() {
		this.logger = createLogger();
		this.logLevel = DEFAULT_LOG_LEVEL;
	}

	start(): void {
		this.logger.info("Application started");
	}

	stop(): void {
		this.logger.info("Application stopped");
	}
}

export function main(): void {
	const app = new Application();
	app.start();
}
