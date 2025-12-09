// Utility for fetch with timeout and retry logic

export interface FetchOptions extends RequestInit {
  timeout?: number; // Timeout in milliseconds (default: 5000)
  retries?: number; // Number of retries (default: 2)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
  next?: { revalidate?: number }; // Next.js cache options
}

/**
 * Fetch with timeout and automatic retry
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 5000, // 5 second timeout
    retries = 2,
    retryDelay = 1000,
    next,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Build fetch options, preserving Next.js cache options
        const fetchOpts: RequestInit & { next?: { revalidate?: number } } = {
          ...fetchOptions,
          signal: controller.signal,
        };
        
        // Preserve Next.js cache options if provided
        if (next) {
          fetchOpts.next = next;
        }
        
        const response = await fetch(url, fetchOpts);

        clearTimeout(timeoutId);

        // Only retry on network errors or 5xx errors
        if (!response.ok && response.status >= 500 && attempt < retries) {
          const error = new Error(`Server error: ${response.status}`);
          // @ts-expect-error - Adding custom property
          error.status = response.status;
          throw error;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Don't retry on abort (timeout) - throw immediately
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout) or client errors (4xx)
      if (
        lastError.name === 'AbortError' ||
        (lastError.message.includes('status:') &&
          parseInt(lastError.message.split('status:')[1]?.trim() || '0') < 500)
      ) {
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

