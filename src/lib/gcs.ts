
import { Storage } from '@google-cloud/storage';

const gcsBucketName = process.env.GCS_BUCKET_NAME;
// The GOOGLE_APPLICATION_CREDENTIALS env var is read automatically by the Storage constructor
const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let storage: Storage | null = null;
let gcsWarningShown = false;

if (!gcsBucketName || !googleAppCreds) {
  if (!gcsWarningShown) {
    console.warn('----------------------------------------------------------------');
    console.warn('WARNING: GCS environment variables (GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS) are not set.');
    console.warn('File upload functionality will be disabled.');
    console.warn('Please update your .env.local file with your bucket name and the path to your service account key file.');
    console.warn('----------------------------------------------------------------');
    gcsWarningShown = true;
  }
} else {
  try {
    // The Storage constructor automatically uses GOOGLE_APPLICATION_CREDENTIALS
    // if it's set in the environment. No need to pass any config.
    storage = new Storage();
    console.log('Google Cloud Storage client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Google Cloud Storage. Please check your service account key file path and permissions.', error);
  }
}

export const getGcsClient = (): Storage | null => {
  return storage;
};

export const getGcsBucketName = (): string | undefined => {
  return gcsBucketName;
};
