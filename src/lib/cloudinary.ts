export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

export interface UploadProgressInfo {
  loaded: number;
  total: number;
  percent: number;
}

export interface CloudinaryUploadOptions {
  onProgress?: (info: UploadProgressInfo) => void;
  onXhrCreated?: (xhr: XMLHttpRequest) => void;
}

export async function uploadToCloudinary(
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'Laxmi_popup';

  if (!cloudName || cloudName.trim() === '' || cloudName.includes('<I WILL PROVIDE THIS>')) {
    throw new Error('Cloudinary Cloud Name is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in your environment settings.');
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName.trim()}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset.trim());
  formData.append('folder', 'popup');

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (options.onXhrCreated) {
      options.onXhrCreated(xhr);
    }

    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          percent
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data && data.secure_url) {
            resolve({
              secure_url: data.secure_url,
              public_id: data.public_id,
              format: data.format,
              bytes: data.bytes,
              width: data.width,
              height: data.height
            });
          } else {
            reject(new Error('Cloudinary response did not contain secure_url'));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse Cloudinary response: ${e?.message || 'Unknown error'}`));
        }
      } else {
        let errorMsg = `Cloudinary upload failed (Status ${xhr.status})`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson?.error?.message) {
            errorMsg = errJson.error.message;
          }
        } catch (_) {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Cloudinary upload. Please check your connection.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload canceled by user.'));
    };

    xhr.send(formData);
  });
}
