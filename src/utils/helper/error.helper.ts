export function getErrorMessage(
  error: unknown,
  fallback = 'Đã xảy ra lỗi'
): string {
  return error instanceof Error ? error.message : fallback;
}

export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
