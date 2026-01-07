"use server"
import { BlobServiceClient } from "@azure/storage-blob";

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is not defined");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "productimages";

export async function uploadFileToBlob(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;

    const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);

    await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });
    
    console.log("File uploaded successfully:", blockBlobClient.url);
    return blockBlobClient.url;
  } catch (error) {
    console.error("Error uploading file to blob storage:", error);
    throw new Error("Failed to upload file to storage");
  }
}

export async function uploadVideoToBlob(
  videoBuffer: Buffer,
  chatId: string,
  fileName?: string
): Promise<string> {
  try {
    const containerClient = blobServiceClient.getContainerClient("generatedvideos");

    const timestamp = Date.now();
    const videoFileName = fileName || `${chatId}-creative-${timestamp}.mp4`;

    const blockBlobClient = containerClient.getBlockBlobClient(videoFileName);

    await blockBlobClient.uploadData(videoBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'video/mp4',
        blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    console.log("✓ Video uploaded successfully:", blockBlobClient.url);
    return blockBlobClient.url;
  } catch (error) {
    console.error("Error uploading video to blob storage:", error);
    throw new Error("Failed to upload video to storage");
  }
}

export async function deleteFileFromBlob(fileUrl: string): Promise<void> {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = fileUrl.split("/").pop();
    
    if (!blobName) {
      throw new Error("Invalid file URL");
    }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  } catch (error) {
    console.error("Error deleting file from blob storage:", error);
    throw new Error("Failed to delete file from storage");
  }
}


export async function getFileFromBlob(fileName: string): Promise<string> {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    const exists = await blockBlobClient.exists();
    if (!exists) {
      throw new Error("File not found");
    }

    return blockBlobClient.url;
  } catch (error) {
    console.error("Error getting file from blob storage:", error);
    throw new Error("Failed to get file from storage");
  }
}
