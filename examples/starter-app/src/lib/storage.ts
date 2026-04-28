import { BlobServiceClient } from '@azure/storage-blob'

function getContainerClient() {
  const client = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  )
  return client.getContainerClient(process.env.AZURE_STORAGE_CONTAINER!)
}

export async function uploadFile(
  blobName: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const container = getContainerClient()
  await container.uploadBlockBlob(blobName, data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return `${process.env.AZURE_STORAGE_URL}/${process.env.AZURE_STORAGE_CONTAINER}/${blobName}`
}

export async function deleteFile(blobName: string): Promise<void> {
  const container = getContainerClient()
  await container.deleteBlob(blobName)
}
