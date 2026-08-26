import { describe, it, expect } from 'vitest';
import { parseApiError } from './errorUtils';

describe('parseApiError', () => {
  it('should return fallback message if no error is provided', () => {
    expect(parseApiError(null)).toBe('An error occurred. Please try again.');
    expect(parseApiError(undefined)).toBe('An error occurred. Please try again.');
  });

  it('should return custom fallback message if no error is provided', () => {
    expect(parseApiError(null, 'Custom fallback')).toBe('Custom fallback');
  });

  describe('when error response contains string data', () => {
    it('should handle HTML server error starting with <', () => {
      const err = { response: { data: '<html><body>Server Error</body></html>', status: 500 } };
      expect(parseApiError(err)).toBe('Server Error (500). Please try again later.');
    });

    it('should handle HTML server error containing <!DOCTYPE html>', () => {
      const err = { response: { data: '<!DOCTYPE html><html><body>Server Error</body></html>', status: 500 } };
      expect(parseApiError(err)).toBe('Server Error (500). Please try again later.');
    });

    it('should return plain string data', () => {
      const err = { response: { data: 'A simple string error', status: 400 } };
      expect(parseApiError(err)).toBe('A simple string error');
    });
  });

  describe('when error response contains object data', () => {
    it('should extract "detail" property', () => {
      const err = { response: { data: { detail: 'Detail error message' }, status: 400 } };
      expect(parseApiError(err)).toBe('Detail error message');
    });

    it('should extract "error" property', () => {
      const err = { response: { data: { error: 'Error property message' }, status: 400 } };
      expect(parseApiError(err)).toBe('Error property message');
    });

    it('should extract "message" property', () => {
      const err = { response: { data: { message: 'Message property error' }, status: 400 } };
      expect(parseApiError(err)).toBe('Message property error');
    });

    it('should extract array of "non_field_errors"', () => {
      const err = { response: { data: { non_field_errors: ['Error 1.', 'Error 2.'] }, status: 400 } };
      expect(parseApiError(err)).toBe('Error 1. Error 2.');
    });

    it('should extract string "non_field_errors"', () => {
      const err = { response: { data: { non_field_errors: 'A non field error' }, status: 400 } };
      expect(parseApiError(err)).toBe('A non field error');
    });

    it('should format field-specific errors correctly and skip internal metadata codes', () => {
      const err = {
        response: {
          data: {
            code: 'invalid', // should be skipped
            username: 'admin', // should be skipped
            booking_date: ['Date is in the past.'],
            first_name: 'Is required.',
            address: { line1: 'Required' },
          },
          status: 400
        }
      };
      // Note: Object.entries order is generally insertion order for simple keys
      // Expected formatting: Booking Date: Date is in the past. | First Name: Is required. | Address: {"line1":"Required"}
      expect(parseApiError(err)).toBe('Booking Date: Date is in the past. | First Name: Is required. | Address: {"line1":"Required"}');
    });
  });

  describe('when error response does not have handled data but has specific status codes', () => {
    it('should handle 401 Unauthorized', () => {
      const err = { response: { status: 401 } };
      expect(parseApiError(err)).toBe('Session expired or unauthenticated. Please log in.');
    });

    it('should handle 403 Forbidden', () => {
      const err = { response: { status: 403 } };
      expect(parseApiError(err)).toBe('You do not have permission to perform this action.');
    });

    it('should handle 404 Not Found', () => {
      const err = { response: { status: 404 } };
      expect(parseApiError(err)).toBe('The requested resource was not found.');
    });

    it('should handle 500 Internal Server Error', () => {
      const err = { response: { status: 500 } };
      expect(parseApiError(err)).toBe('Internal server error. Please try again later.');
    });
  });

  describe('when error has a message property (e.g., network error or standard Error)', () => {
    it('should handle "Network Error" specifically', () => {
      const err = { message: 'A Network Error occurred' };
      expect(parseApiError(err)).toBe('Unable to connect to the server. Please check backend network connection.');
    });

    it('should return the error message for other errors', () => {
      const err = { message: 'Some other error message' };
      expect(parseApiError(err)).toBe('Some other error message');
    });
  });
});
