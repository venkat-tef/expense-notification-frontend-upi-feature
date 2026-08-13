import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface CloudinaryUploadResult {
  /** Cloudinary's `secure_url` — safe to store in Firestore and render/link directly. */
  url: string;
  /**
   * Cloudinary's `public_id` — stored purely as metadata (e.g. for display, or if a
   * signed admin/backend deletion flow is added later). It CANNOT be used to delete
   * the asset from this client: unsigned uploads intentionally have no matching
   * unsigned-delete API, since that would require exposing the API secret here.
   */
  publicId: string;
  /** 'image' | 'raw' | 'video' — lets callers decide how to render/open the file. */
  resourceType: string;
  format?: string;
  bytes?: number;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Shared Cloudinary upload helper — the single place both expense attachments and
 * member profile photos go through, mirroring how ExpenseService used to be the one
 * place Firebase Storage uploads happened.
 *
 * Uses Cloudinary's UNSIGNED upload flow only (a `POST` with `upload_preset`, no API
 * key/secret). This is a deliberate architecture choice: it's the only Cloudinary
 * upload method that never requires the API secret in client-side code. What an
 * unsigned upload is allowed to do (folders, formats, size) is controlled by the
 * preset's own settings in the Cloudinary dashboard, not by this code.
 */
@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  /**
   * Uploads `file` into Cloudinary under `folder` (e.g. 'nestly/bill-images/2026-08').
   * Throws (does not silently fail) on missing config, oversized files, or a failed
   * request, so callers can show an error and never end up stuck mid-"saving".
   */
  async uploadFile(file: File, folder: string): Promise<CloudinaryUploadResult> {
    const { cloudName, uploadPreset } = environment.cloudinary;

    if (!cloudName || cloudName.startsWith('YOUR_') || !uploadPreset || uploadPreset.startsWith('YOUR_')) {
      throw new Error('Cloudinary is not configured yet. Set cloudName/uploadPreset in environment.ts.');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('File must be 5 MB or smaller.');
    }

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('upload_preset', uploadPreset);
    form.append('folder', folder);

    // TEMP DIAGNOSTICS — safe to remove once iPhone uploads are confirmed working.
    // Confirms what environment.cloudinary actually resolved to at runtime, and what
    // ends up in the FormData, without printing anything secret (preset name and
    // cloud name are not secrets — no API key/secret exists anywhere in this file).
    console.log('[Cloudinary] resolved config', {
      production: environment.production,
      cloudName,
      uploadPreset,
    });
    form.forEach((value, key) => {
      console.log('[Cloudinary] FormData entry', key, value instanceof File ? `File(${value.name}, ${value.size}b)` : value);
    });

    // The 'auto' resource type lets Cloudinary route images vs. PDFs/other documents
    // correctly on its own, without this code branching on file.type.
    //
    // ngsw-bypass: Angular's service worker (registered for PWA/offline support)
    // intercepts every fetch from the page, including cross-origin ones — this is
    // documented Angular behavior, not a bug in this app. On iOS Safari/WKWebView
    // specifically, routing a FormData-with-File body through a service worker's
    // fetch handling corrupts the body: the file part can survive but other fields
    // (like upload_preset) get dropped or turned into "[FormData Object]" instead of
    // their real value (see WebKit bug 187461). That's the exact shape of this bug —
    // Cloudinary receives no upload_preset and rejects with a 400. It doesn't matter
    // whether the request is made with fetch() or XMLHttpRequest; both are dispatched
    // through the same service worker fetch event. ngsw-bypass is Angular's official,
    // documented way to tell its service worker to let a specific request go straight
    // to the network untouched — it only affects this one request.
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload?ngsw-bypass=true`;

    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'POST', body: form });
    } catch (err) {
      throw new Error('Could not reach Cloudinary. Check your connection and try again.');
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      console.error('Cloudinary upload failed', response.status, bodyText, { cloudName, uploadPreset });
      throw new Error('Upload failed. Please try again.');
    }

    const data = await response.json();

    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
      format: data.format,
      bytes: data.bytes,
    };
  }
}