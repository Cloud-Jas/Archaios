using Azure.Storage.Blobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Services
{
    public class BlobDownloader
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly ILogger<BlobDownloader> _logger;

        public BlobDownloader(IConfiguration configuration, ILogger<BlobDownloader> logger)
        {
            var connectionString = configuration["BlobStorageConnString"];
            _blobServiceClient = new BlobServiceClient(connectionString);
            _logger = logger;
        }

        public async Task<string> DownloadTextFileAsync(string containerName, string blobName)
        {
            try
            {
                _logger.LogInformation($"Downloading blob {blobName} from container {containerName}");
                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                var blobClient = containerClient.GetBlobClient(blobName);

                if (!await blobClient.ExistsAsync())
                {
                    _logger.LogWarning($"Blob {blobName} does not exist in container {containerName}");
                    return null;
                }

                using var memoryStream = new MemoryStream();
                await blobClient.DownloadToAsync(memoryStream);
                memoryStream.Position = 0;

                using var streamReader = new StreamReader(memoryStream);
                var content = await streamReader.ReadToEndAsync();

                _logger.LogInformation($"Successfully downloaded blob {blobName} ({content.Length} bytes)");
                return content;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error downloading blob {blobName} from container {containerName}");
                throw;
            }
        }

        public async Task<Stream> DownloadFileStreamAsync(string containerName, string blobName)
        {
            try
            {
                _logger.LogInformation($"Downloading blob {blobName} from container {containerName} as stream");
                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                var blobClient = containerClient.GetBlobClient(blobName);

                if (!await blobClient.ExistsAsync())
                {
                    _logger.LogWarning($"Blob {blobName} does not exist in container {containerName}");
                    return null;
                }

                var download = await blobClient.DownloadAsync();
                _logger.LogInformation($"Successfully downloaded blob {blobName} as stream");
                return download.Value.Content;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error downloading blob {blobName} from container {containerName} as stream");
                throw;
            }
        }
    }
}
