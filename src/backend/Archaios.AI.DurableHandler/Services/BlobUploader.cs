using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Specialized;
using Microsoft.Extensions.Configuration;

namespace Archaios.AI.DurableHandler.Services;

public class BlobUploader
{
    private readonly BlobServiceClient _blobServiceClient;

    public BlobUploader(IConfiguration configuration)
    {
        var connectionString = configuration["BlobStorageConnString"];
        _blobServiceClient = new BlobServiceClient(connectionString);
    }

    public async Task StageBlockAsync(string fileName, string blockId, Stream data)
    {
        var container = _blobServiceClient.GetBlobContainerClient("uploads");
        await container.CreateIfNotExistsAsync();

        var blob = container.GetBlockBlobClient(fileName);
        await blob.StageBlockAsync(blockId, data);
    }

    public async Task CommitBlocksAsync(string fileName, List<string> blockIds)
    {
        var container = _blobServiceClient.GetBlobContainerClient("uploads");
        var blob = container.GetBlockBlobClient(fileName);
        await blob.CommitBlockListAsync(blockIds);
    }
}
