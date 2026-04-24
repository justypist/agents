/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  isValidAbortUploadRequest,
  isValidCompleteUploadRequest,
  isValidPrepareUploadRequest,
} from './upload-validation';

const validHash = 'a'.repeat(64);

describe('upload request validation', () => {
  describe('isValidPrepareUploadRequest', () => {
    it('accepts valid prepare payloads', () => {
      expect(
        isValidPrepareUploadRequest({
          hash: validHash,
          size: 42,
          mimeType: 'text/plain',
          originalFilename: 'notes.txt',
        }),
      ).toBe(true);
    });

    it('rejects malformed prepare payloads', () => {
      expect(isValidPrepareUploadRequest(null)).toBe(false);
      expect(
        isValidPrepareUploadRequest({
          hash: 'bad',
          size: 42,
          mimeType: 'text/plain',
          originalFilename: 'notes.txt',
        }),
      ).toBe(false);
      expect(
        isValidPrepareUploadRequest({
          hash: validHash,
          size: 0,
          mimeType: 'text/plain',
          originalFilename: 'notes.txt',
        }),
      ).toBe(false);
      expect(
        isValidPrepareUploadRequest({
          hash: validHash,
          size: Number.POSITIVE_INFINITY,
          mimeType: 'text/plain',
          originalFilename: 'notes.txt',
        }),
      ).toBe(false);
      expect(
        isValidPrepareUploadRequest({
          hash: validHash,
          size: 42,
          mimeType: 'text/plain',
          originalFilename: '   ',
        }),
      ).toBe(false);
    });
  });

  describe('isValidCompleteUploadRequest', () => {
    it('accepts valid single upload completion payloads', () => {
      expect(
        isValidCompleteUploadRequest({
          status: 'single',
          hash: validHash,
          key: 'files/a',
          size: 42,
          mimeType: 'text/plain',
        }),
      ).toBe(true);
    });

    it('accepts valid multipart upload completion payloads', () => {
      expect(
        isValidCompleteUploadRequest({
          status: 'multipart',
          hash: validHash,
          key: 'files/a',
          size: 42,
          mimeType: 'text/plain',
          uploadId: 'upload-1',
          parts: [{ partNumber: 1, etag: 'etag-1' }],
        }),
      ).toBe(true);
    });

    it('rejects malformed completion payloads', () => {
      expect(isValidCompleteUploadRequest(null)).toBe(false);
      expect(
        isValidCompleteUploadRequest({
          status: 'single',
          hash: validHash,
          key: ' ',
          size: 42,
          mimeType: 'text/plain',
        }),
      ).toBe(false);
      expect(
        isValidCompleteUploadRequest({
          status: 'multipart',
          hash: validHash,
          key: 'files/a',
          size: 42,
          mimeType: 'text/plain',
          uploadId: '',
          parts: [{ partNumber: 1, etag: 'etag-1' }],
        }),
      ).toBe(false);
      expect(
        isValidCompleteUploadRequest({
          status: 'multipart',
          hash: validHash,
          key: 'files/a',
          size: 42,
          mimeType: 'text/plain',
          uploadId: 'upload-1',
          parts: [{ partNumber: 0, etag: 'etag-1' }],
        }),
      ).toBe(false);
      expect(
        isValidCompleteUploadRequest({
          status: 'multipart',
          hash: validHash,
          key: 'files/a',
          size: 42,
          mimeType: 'text/plain',
          uploadId: 'upload-1',
          parts: [],
        }),
      ).toBe(false);
    });
  });

  describe('isValidAbortUploadRequest', () => {
    it('accepts valid abort payloads', () => {
      expect(
        isValidAbortUploadRequest({
          key: 'files/a',
          uploadId: 'upload-1',
        }),
      ).toBe(true);
    });

    it('rejects malformed abort payloads', () => {
      expect(isValidAbortUploadRequest(null)).toBe(false);
      expect(isValidAbortUploadRequest({ key: '', uploadId: 'upload-1' })).toBe(false);
      expect(isValidAbortUploadRequest({ key: 'files/a', uploadId: ' ' })).toBe(false);
    });
  });
});
