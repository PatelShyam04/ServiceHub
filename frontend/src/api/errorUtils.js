/**
 * Helper function to parse Axios / API error responses into clean, user-friendly strings.
 * Handles string errors, DRF object field errors, HTML error pages, and network failures.
 */
export const parseApiError = (err, fallbackMsg = 'An error occurred. Please try again.') => {
  if (!err) return fallbackMsg;

  if (err.response) {
    const data = err.response.data;
    const status = err.response.status;

    if (data) {
      if (typeof data === 'string') {
        if (data.trim().startsWith('<') || data.includes('<!DOCTYPE html>')) {
          return `Server Error (${status}). Please try again later.`;
        }
        return data;
      }

      if (typeof data === 'object') {
        // Simple detail or error message
        if (data.detail && typeof data.detail === 'string') {
          return data.detail;
        }
        if (data.error && typeof data.error === 'string') {
          return data.error;
        }
        if (data.message && typeof data.message === 'string') {
          return data.message;
        }

        // Handle array of non-field errors
        if (data.non_field_errors) {
          if (Array.isArray(data.non_field_errors)) {
            return data.non_field_errors.join(' ');
          }
          if (typeof data.non_field_errors === 'string') {
            return data.non_field_errors;
          }
        }

        // Collect field-specific errors e.g. { address: ["This field is required."], booking_date: [...] }
        const messages = [];
        for (const [key, value] of Object.entries(data)) {
          if (key === 'code' || key === 'username') continue; // Skip internal metadata codes

          const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (Array.isArray(value)) {
            messages.push(`${fieldName}: ${value.join(', ')}`);
          } else if (typeof value === 'string') {
            messages.push(`${fieldName}: ${value}`);
          } else if (typeof value === 'object' && value !== null) {
            messages.push(`${fieldName}: ${JSON.stringify(value)}`);
          }
        }

        if (messages.length > 0) {
          return messages.join(' | ');
        }
      }
    }

    if (status === 401) return 'Session expired or unauthenticated. Please log in.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status === 500) return 'Internal server error. Please try again later.';
  }

  if (err.message) {
    if (err.message.includes('Network Error')) {
      return 'Unable to connect to the server. Please check backend network connection.';
    }
    return err.message;
  }

  return fallbackMsg;
};
