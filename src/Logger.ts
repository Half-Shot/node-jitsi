export type LoggerFunc = (moduleName: string) => ILogger;

export interface ILogger {
    debug: (...parts: any[]) => void,
    info: (...parts: any[]) => void,
    warn: (...parts: any[]) => void,
    error: (...parts: any[]) => void,
}

export class DummyLogger implements ILogger{
    debug() { };
    info() { };
    warn() { };
    error() { };
}

export class FancyLogger implements ILogger {
    private chalk: any;
    constructor(private moduleName: string) {
        this.chalk = require('chalk');
    }
    debug(...parts: any[]) {
        console.log(`${this.chalk.blue('DEBG')} [${this.moduleName}]`, ...parts);
    }
    info(...parts: any[]) {
        console.info(`${this.chalk.green('INFO')} [${this.moduleName}]`, ...parts);
    }
    warn(...parts: any[]) {
        console.warn(`${this.chalk.yellow('WARN')} [${this.moduleName}]`, ...parts);
    }
    error(...parts: any[]) {
        console.error(`${this.chalk.red('ERRO')} [${this.moduleName}]`, ...parts);
    }
}