using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Shared.Models
{
    public class GeeDto
    {
    }
    public class GeoCoordinates
    {
        [JsonProperty("latitude")]
        public double Latitude { get; set; }

        [JsonProperty("longitude")]
        public double Longitude { get; set; }

        [JsonProperty("hasValidCoordinates")]
        public bool HasValidCoordinates => !(Latitude == 0 && Longitude == 0);
    }

    public class GeeCoordinateMessage
    {
        [JsonProperty("siteId")]
        public string SiteId { get; set; }

        [JsonProperty("coordinates")]
        public GeoCoordinates Coordinates { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        // Add new properties for the GEE workflow
        [JsonProperty("collection")]
        public string Collection { get; set; } = "LANDSAT/LC08/C02/T1_TOA";
        
        [JsonProperty("analysisType")]
        public string AnalysisType { get; set; } = "ndvi";
        
        [JsonProperty("bufferDistance")]
        public int BufferDistance { get; set; } = 1000;
        
        [JsonProperty("timeRangeYears")]
        public int TimeRangeYears { get; set; } = 1;

        // Add authentication properties for GEE Python processor
        [JsonProperty("accessToken")]
        public string AccessToken { get; set; }
        
        [JsonProperty("projectId")]
        public string ProjectId { get; set; }
        
        [JsonProperty("callbackUrl")]
        public string CallbackUrl { get; set; }
        
        [JsonProperty("requestId")]
        public string RequestId { get; set; } = Guid.NewGuid().ToString();
    }

    public class GeeImageResult
    {
        public string ImageType { get; set; }
        public string ImageUrl { get; set; }
        public string Collection { get; set; }
        public DateTime ProcessedDate { get; set; }
        public string Description { get; set; }

        public GeeImage ToGeeImage()
        {
            return new GeeImage
            {
                Type = ImageType,
                Url = ImageUrl,
                Collection = Collection,
                Date = ProcessedDate.ToString("yyyy-MM-dd"),
                Description = Description
            };
        }
    }

    public class SatelliteImageryResult
    {
        [JsonProperty("siteId")]
        public string SiteId { get; set; }

        [JsonProperty("ndviImageUrl")]
        public string NdviImageUrl { get; set; }

        [JsonProperty("trueColorImageUrl")]
        public string TrueColorImageUrl { get; set; }

        [JsonProperty("falseColorImageUrl")]
        public string FalseColorImageUrl { get; set; }

        [JsonProperty("processedAt")]
        public DateTime ProcessedAt { get; set; }

        [JsonProperty("images")]
        public List<GeeImage> Images { get; set; } = new List<GeeImage>();
    }

    public class GeeImage
    {
        [JsonProperty("url")]
        public string Url { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("collection")]
        public string Collection { get; set; }

        [JsonProperty("date")]
        public string Date { get; set; }

        [JsonProperty("description")]
        public string Description { get; set; }
    }

    public class SiteImageryUpdateRequest
    {
        public string SiteId { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public SatelliteImageryResult ImageryData { get; set; }
    }

    public class GeeProcessingError
    {
        public string SiteId { get; set; }
        public string Error { get; set; }
    }
}
