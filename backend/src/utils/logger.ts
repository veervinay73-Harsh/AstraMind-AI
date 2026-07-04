type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private static formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    return `[${timestamp}] [${level}] ${contextStr}${message}`;
  }

  public static info(message: string, context?: string): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  public static warn(message: string, context?: string): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  public static error(message: string, error?: any, context?: string): void {
    console.error(this.formatMessage('ERROR', message, context));
    if (error) {
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      } else {
        console.error(JSON.stringify(error, null, 2));
      }
    }
  }

  public static debug(message: string, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }
}
