using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Archaios.AI.DataIngestor.Models;
using System.Security.Policy;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.DataIngestor.Services;

public class UnescoDataService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<UnescoDataService> _logger;
    private const string GEOJSON_URL = "https://whc.unesco.org/?cid=31&l=en&mode=geojson";
    private const string RSS_URL = "https://whc.unesco.org/en/list/rss/";

    public UnescoDataService(ILogger<UnescoDataService> logger)
    {
        _httpClient = new HttpClient();
        _logger = logger;
    }

    private ArchaeologicalSite MapFeatureToSite(ArchaiosUser user, Feature feature, XDocument rssDoc)
    {
        var site = new ArchaeologicalSite
        {
            Id = feature.properties.id_no.ToString(),
            SiteId = feature.properties.id_no.ToString(),
            Name = feature.properties.title,
            DangerLevel = feature.properties.danger,
            Status = "KnownSite",
            ArchaiosUser = user,
            Location = feature.properties.component_state,
            Latitude = feature.geometry.coordinates[1],
            Longitude = feature.geometry.coordinates[0],
            Category = $"Category{feature.properties.cat}",
            Type = "UNESCO World Heritage Site",
            IsPossibleArchaeologicalSite = false,
            IsKnownSite = true,
            LastUpdated = DateTime.UtcNow,
            Components = new List<SiteComponent>
            {
                new SiteComponent
                {
                    Name = feature.properties.component_name,
                    SiteId = feature.properties.id_no.ToString(),
                    State = feature.properties.component_state,
                    Latitude = feature.geometry.coordinates[1],
                    Longitude = feature.geometry.coordinates[0]
                }
            }
        };

        var rssItem = rssDoc.Descendants("item")
              .FirstOrDefault(x => x.Element("title")?.Value == site.Name);

        if (rssItem != null)
        {
            site.Description = CleanDescription(rssItem.Element("description")?.Value);
            site.ImageUrl = ExtractImageUrl(rssItem.Element("description")?.Value);
            site.Url = rssItem.Element("link")?.Value;
        }

        return site;
    }

    private async Task<UnescoDataModel> FetchUnescoData()
    {
        try
        {
            var geoJson = await _httpClient.GetStringAsync(GEOJSON_URL);
            return JsonSerializer.Deserialize<UnescoDataModel>(geoJson)
                     ?? throw new InvalidOperationException("Failed to deserialize UNESCO data.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching UNESCO data from {Url}", GEOJSON_URL);
            throw;
        }
    }

    public async Task<List<ArchaeologicalSite>> GetSitesAsync(ArchaiosUser user)
    {
        var data = await FetchUnescoData();

        var rssData = await _httpClient.GetStringAsync(RSS_URL);
        var rssDoc = XDocument.Parse(rssData);

        var groupedSites = data.features
            .GroupBy(f => f.properties.id_no)
            .Select(g =>
            {
                var firstFeature = g.First();
                var site = MapFeatureToSite(user, firstFeature, rssDoc);
                site.Components = g.Select(f => new SiteComponent
                {
                    Name = f.properties.component_name,
                    State = f.properties.component_state,
                    Latitude = f.geometry.coordinates[1],
                    Longitude = f.geometry.coordinates[0]
                }).ToList();

                return site;
            });

        return groupedSites.ToList();
    }

    private string ExtractImageUrl(string description)
    {
        if (string.IsNullOrEmpty(description)) return null;

        var imgStart = description.IndexOf("src='") + 5;
        return imgStart > 5
            ? description[imgStart..description.IndexOf("'", imgStart)]
            : null;
    }

    private string CleanDescription(string description)
    {
        if (string.IsNullOrEmpty(description)) return null;

        description = description
            .Replace("<![CDATA[", "")
            .Replace("]]>", "");

        var imgStart = description.IndexOf("<img");
        if (imgStart >= 0)
        {
            var imgEnd = description.IndexOf(">", imgStart) + 1;
            description = description.Remove(imgStart, imgEnd - imgStart);
        }

        return description.Trim();
    }
}
