const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 100);
const DEFAULT_USER_QUOTA_MB = Number(process.env.DEFAULT_USER_QUOTA_MB || 500);

function getMaxFileSizeBytes() {
  return MAX_FILE_SIZE_MB * 1024 * 1024;
}

function getDefaultUserQuotaBytes() {
  return DEFAULT_USER_QUOTA_MB * 1024 * 1024;
}

function getAllowedExtensions() {
  return [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.zip',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg',
    '.mp4', '.webm', '.mov', '.avi', '.mkv', '.ppt', '.pptx'
  ];
}

function getAllowedMimeTypes() {
  return [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/octet-stream',
    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/x-mspowerpoint',
    'application/powerpoint',
    'application/mspowerpoint',
    'application/x-ppt',
    // Images
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    // Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ];
}

module.exports = {
  getMaxFileSizeBytes,
  getDefaultUserQuotaBytes,
  getAllowedExtensions,
  getAllowedMimeTypes
};
