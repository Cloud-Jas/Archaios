using Archaios.AI.DurableHandler.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Microsoft.DurableTask;
using Microsoft.AspNetCore.Authorization;
using Archaios.AI.Infrastructure.Repositories.Interfaces;

namespace Archaios.AI.DurableHandler;

public class FxUploadChunkedBlob
{
    private readonly ILogger<FxUploadChunkedBlob> _logger;
    private readonly BlobUploader _blobUploader;
    private readonly QueuePublisher _queuePublisher;
    private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;
    private readonly IUserContextProvider _userContextProvider;

    public FxUploadChunkedBlob(
        ILogger<FxUploadChunkedBlob> logger,
        BlobUploader blobUploader,
        QueuePublisher queuePublisher,
        IArchaeologicalNeo4jRepository archaeologicalRepository,
        IUserContextProvider userContextProvider)
    {
        _logger = logger;
        _blobUploader = blobUploader;
        _queuePublisher = queuePublisher;
        _archaeologicalRepository = archaeologicalRepository;
        _userContextProvider = userContextProvider;
    }

    [Function("UploadChunkedBlob")]
    [Authorize]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "upload")] HttpRequestData req)
    {
        _logger.LogInformation("Processing upload request.");
        try
        {
            var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
            var fileName = query["filename"];
            var blockId = query["blockid"];
            var isFinal = query["final"];

            if (string.IsNullOrEmpty(fileName) || isFinal != "true" && string.IsNullOrEmpty(blockId))
            {
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Missing 'filename' or 'blockid'.");
                return badResponse;
            }

            _logger.LogInformation($"Received request for file: {fileName}, blockId: {blockId}, isFinal: {isFinal}");

            // Check if this is the first chunk by decoding the base64 blockId
            bool isFirstChunk = false;
            if (!string.IsNullOrEmpty(blockId))
            {
                try
                {
                    // Decode base64 to get the original padded number
                    var decodedBytes = Convert.FromBase64String(blockId);
                    var decodedString = System.Text.Encoding.UTF8.GetString(decodedBytes);
                    
                    // Check if this represents "000000" (first chunk)
                    isFirstChunk = decodedString == "000000";
                    _logger.LogInformation($"Decoded blockId: '{decodedString}', isFirstChunk: {isFirstChunk}");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to decode blockId: {ex.Message}");
                }
            }

            if (isFirstChunk)
            {
                var currentUser = await _userContextProvider.GetCurrentUserAsync(req);
                if (currentUser == null)
                {
                    var unauthorizedResponse = req.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User authentication required");
                    return unauthorizedResponse;
                }

                var fileNameWithoutExtension = System.IO.Path.GetFileNameWithoutExtension(fileName);
                
                _logger.LogInformation($"Checking if site '{fileNameWithoutExtension}' already exists for user {currentUser.Id}");

                var allSites = await _archaeologicalRepository.GetArchaiosSitesAsync();
                var existingSite = allSites.FirstOrDefault(site => 
                    site.Name.Equals(fileNameWithoutExtension, StringComparison.OrdinalIgnoreCase) &&
                    (site.ArchaiosUser?.Id == currentUser.Id || site.ArchaiosUser?.Oid == currentUser.Oid));

                if (existingSite != null)
                {
                    _logger.LogInformation($"File '{fileName}' has already been processed as site '{existingSite.Name}' (ID: {existingSite.SiteId})");
                    
                    var alreadyProcessedResponse = req.CreateResponse(System.Net.HttpStatusCode.Conflict);
                    await alreadyProcessedResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                        error = "FileAlreadyProcessed",
                        message = $"This file has already been processed",
                        siteId = existingSite.SiteId,
                        siteName = existingSite.Name,
                        processedDate = existingSite.LastUpdated
                    }));
                    return alreadyProcessedResponse;
                }
            }

            if (isFinal == "true")
            {
                _logger.LogInformation($"Finalizing upload for file: {fileName}");
                using var reader = new StreamReader(req.Body);
                var json = await reader.ReadToEndAsync();
                var blockIds = JsonSerializer.Deserialize<List<string>>(json);
                await _blobUploader.CommitBlocksAsync(fileName, blockIds);

                var okResponse = req.CreateResponse(System.Net.HttpStatusCode.OK);
                await okResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    message = "File upload completed",
                    fileName
                }));
                return okResponse;
            }
            else
            {
                _logger.LogInformation($"Uploading chunk for file: {fileName}, blockId: {blockId}");
                using var ms = new MemoryStream();
                await req.Body.CopyToAsync(ms);
                ms.Position = 0;

                await _blobUploader.StageBlockAsync(fileName, blockId, ms);

                var okResponse = req.CreateResponse(System.Net.HttpStatusCode.OK);
                await okResponse.WriteStringAsync("Chunk uploaded.");
                return okResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing upload request.");
            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("An error occurred while processing the request.");
            return errorResponse;
        }
    }
}
