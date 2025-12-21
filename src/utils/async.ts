export const withTimeout = <T>(
  promise: PromiseLike<T>,
  ms: number = 10000,
  errorMessage = "Request timed out"
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
};
