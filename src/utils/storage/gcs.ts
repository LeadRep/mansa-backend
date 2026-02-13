import { Storage } from "@google-cloud/storage";

const projectId = process.env.GCS_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const bucketName = process.env.GCS_BUCKET;

const storage = new Storage(
  projectId || keyFilename ? { projectId, keyFilename } : undefined
);

export const uploadFileToGcs = async (params: {
  localPath: string;
  destination: string;
  contentType?: string;
}) => {
  if (!bucketName) {
    throw new Error("GCS_BUCKET is not set");
  }
  const bucket = storage.bucket(bucketName);
  const { localPath, destination, contentType } = params;
  await bucket.upload(localPath, {
    destination,
    metadata: contentType ? { contentType } : undefined,
  });

  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
};
