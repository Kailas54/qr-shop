/** Remove credentials if a driver error echoes the connection string. */
export function sanitizeDbMessage(message: string): string {
  return message.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[redacted]');
}

export function dbErrorFields(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: sanitizeDbMessage(error.message) };
  }
  return { name: 'Error', message: 'Unknown database error' };
}
