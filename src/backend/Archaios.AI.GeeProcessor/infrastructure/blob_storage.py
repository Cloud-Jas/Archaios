from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ClientAuthenticationError
import logging
from urllib.parse import urlparse
import os

logger = logging.getLogger("Archaios.BlobStorage")

class AzureBlobStorage:
    """Service for interacting with Azure Blob Storage."""
    
    def __init__(self, connection_string: str = None):
        """Initialize with Azure Storage connection string."""
        if connection_string is None:
            connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
            
        if not connection_string:
            logger.warning("No Azure Storage connection string provided. Blob storage operations will fail.")
            self.blob_service_client = None
        else:
            self.blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            logger.info("Azure Blob Storage client initialized")

    async def download_file(self, uri: str, local_path: str) -> None:
        """Download a file from blob storage to a local path."""
        try:
            if not self.blob_service_client:
                raise Exception("Blob service client not initialized")
                
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

            logger.info(f"Successfully downloaded blob {blob_name} to {local_path}")
            return True

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
            if not self.blob_service_client:
                raise Exception("Blob service client not initialized")
                
            # Create container if it doesn't exist
            container_client = self.blob_service_client.get_container_client(container_name)
            if not container_client.exists():
                logger.info(f"Creating container {container_name}")
                container_client.create_container()
                
            # Get blob client and upload the file
            blob_client = container_client.get_blob_client(blob_name)
            
            with open(local_path, "rb") as file:
                blob_client.upload_blob(file, overwrite=True)
            
            logger.info(f"Successfully uploaded {local_path} to {blob_client.url}")
            return blob_client.url

        except Exception as e:
            logger.error(f"Error uploading file {local_path}: {str(e)}")
            return None

    async def create_container_if_not_exists(self, container_name: str) -> None:
        """Create a container if it doesn't exist."""
        try:
            if not self.blob_service_client:
                raise Exception("Blob service client not initialized")
                
            container_client = self.blob_service_client.get_container_client(container_name)
            if not container_client.exists():
                logger.info(f"Creating container {container_name}")
                container_client.create_container()
                
            return True
        except Exception as e:
            logger.error(f"Error creating container {container_name}: {str(e)}")
            return False
