
import { Storage } from '@google-cloud/storage';

const gcsBucketName = process.env.GCS_BUCKET_NAME;
const gcsServiceAccountJson = process.env.GCS_SERVICE_ACCOUNT_JSON;

let storage: Storage | null = null;
let gcsWarningShown = false;

if (!gcsBucketName || !gcsServiceAccountJson) {
  if (!gcsWarningShown) {
    console.warn('----------------------------------------------------------------');
    console.warn('WARNING: GCS environment variables (GCS_BUCKET_NAME, GCS_SERVICE_ACCOUNT_JSON) are not set.');
    console.warn('File upload functionality will be disabled.');
    console.warn('Please update your .env.local file with credentials for Google Cloud Storage.');
    console.warn('----------------------------------------------------------------');
    gcsWarningShown = true;
  }
} else {
  try {
    const serviceAccount = JSON.parse(gcsServiceAccountJson);
    storage = new Storage({
      credentials: serviceAccount,
      projectId: serviceAccount.project_id,
    });
    console.log('Google Cloud Storage client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Google Cloud Storage. Please check GCS_SERVICE_ACCOUNT_JSON in your .env.local file.', error);
  }
}

export const getGcsClient = (): Storage | null => {
  return storage;
};

export const getGcsBucketName = (): string | undefined => {
  return gcsBucketName;
};
