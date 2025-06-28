from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ClientAuthenticationError
import logging
from urllib.parse import urlparse
from core.interfaces import IBlobStorage

logger = logging.getLogger("Archaios.BlobStorage")

class AzureBlobStorage(IBlobStorage):
    def __init__(self, connection_string: str):
        self.blob_service_client = BlobServiceClient.from_connection_string(connection_string)

    async def download_file(self, uri: str, local_path: str) -> None:
        try:
            # Parse the blob URL to get container and blob name
            parsed_url = urlparse(uri)
            path_parts = parsed_url.path.strip('/').split('/')
            container_name = path_parts[0]
            blob_name = '/'.join(path_parts[1:])

            # Get clients for container and blob
            container_client = self.blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)

            # Use synchronous download methods
            with open(local_path, "wb") as file:
                download_stream = blob_client.download_blob()
                file.write(download_stream.readall())

            logger.info(f"Successfully downloaded blob {blob_name}")

        except ClientAuthenticationError as auth_error:
            logger.error(f"Authentication error accessing blob: {uri}")
            logger.error(f"Details: {str(auth_error)}")
            raise
        except Exception as e:
            logger.error(f"Error downloading blob {uri}: {str(e)}")
            raise

    async def upload_file(self, local_path: str, container_name: str, blob_name: str) -> str:
        """Upload a file to blob storage and return its URL."""
        try:
            # Get client for container
            container_client = self.blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)
            
            # Use synchronous upload methods
            with open(local_path, "rb") as file:
                blob_client.upload_blob(file, overwrite=True)
            
            logger.info(f"Successfully uploaded {local_path} to {blob_client.url}")
            return blob_client.url

        except Exception as e:
            logger.error(f"Error uploading file {local_path}: {str(e)}")
            raise