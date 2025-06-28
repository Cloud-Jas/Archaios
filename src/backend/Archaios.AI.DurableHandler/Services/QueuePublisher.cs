using Archaios.AI.Shared.Models;
using Azure.Storage.Queues;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Services;

public class ProcessingConfiguration<T>
{
    public string FileName { get; set; } = string.Empty;
    public string InstanceId { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
    public string SiteId { get; set; } = string.Empty;
    public T ProcessingParameters { get; set; } = default!;
}

public class QueuePublisher
{
    private readonly QueueClient _storageProcessingQueueClient;
    private readonly string _blobStorageUrl;
    private readonly ILogger<QueuePublisher> _logger;
    private readonly QueueClient _storageCoordinatesQueueClient;

    public QueuePublisher(IConfiguration configuration, ILogger<QueuePublisher> logger)
    {
        _logger = logger;
        _blobStorageUrl = configuration["BlobStorageUrl"] ?? throw new ArgumentNullException("BlobStorageUrl must be set");
        var storageConnection = configuration["BlobStorageConnString"] ?? throw new ArgumentNullException("BlobStorageConnString must be set");
        var processingQueueName = configuration["StorageQueueName"] ?? "lidar-processing";
        var geeCoordinatesQueueName = configuration["GeeCoordinatesQueueName"] ?? "coordinates-processing";

        _storageProcessingQueueClient = new QueueClient(storageConnection, processingQueueName);
        _storageProcessingQueueClient.CreateIfNotExists();

        _storageCoordinatesQueueClient = new QueueClient(storageConnection, geeCoordinatesQueueName);
        _storageCoordinatesQueueClient.CreateIfNotExists();
    }

    public async Task SendProcessingMessageAsync<T>(ProcessingConfiguration<T> config)
    {
        var message = new
        {
            InstanceId = config.InstanceId,
            EventName = config.EventName,
            BlobUri = $"{GetBlobContainerUrl()}/{config.FileName}",
            SiteId = config.SiteId,
            Parameters = config.ProcessingParameters
        };

        var messageJson = JsonConvert.SerializeObject(message);
        await _storageProcessingQueueClient.SendMessageAsync(
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(messageJson)));

        _logger.LogInformation($"Sent {typeof(T).Name} processing message for file: {config.FileName}, instanceId: {config.InstanceId}");
    }

    private string GetBlobContainerUrl()
    {
        return $"{_blobStorageUrl}/uploads";
    }

    public async Task PublishCoordinateMessageAsync(GeeCoordinateMessage message)
    {
        try
        {
            _logger.LogInformation($"Publishing coordinates for site {message.SiteId}: ({message.Coordinates.Latitude}, {message.Coordinates.Longitude})");

            string messageJson = JsonConvert.SerializeObject(message);
            string base64Message = Convert.ToBase64String(Encoding.UTF8.GetBytes(messageJson));

            await _storageCoordinatesQueueClient.SendMessageAsync(base64Message);
            _logger.LogInformation($"Successfully published coordinates message for site {message.SiteId}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error publishing coordinates message for site {message.SiteId}");
            throw;
        }
    }
}
