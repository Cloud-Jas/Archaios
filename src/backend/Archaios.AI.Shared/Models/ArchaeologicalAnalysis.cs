using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Shared.Models
{
    public class ArchaeologicalTeamAnalysisRequest
    {
        public string SiteId { get; set; } = string.Empty;
        public string? HistoricalContext { get; set; }
        public double Latitude { get; set; } = 0.0;
        public double Longitude { get; set; } = 0.0;
        public Dictionary<string, AnalysisResult> AnalysisResults { get; set; } = new Dictionary<string, AnalysisResult>();
        public string UserId { get; set; } = string.Empty;
    }

    public class ImageAnalysisRequest
    {
        public string ImageUrl { get; set; } = string.Empty;
        public string ImageType { get; set; } = string.Empty;
        public string SiteId { get; set; } = string.Empty;
        public string? HistoricalContext { get; set; }
    }
    public class GroupedImageAnalysisRequest
    {
        public string SiteId { get; set; }
        public string? HistoricalContext { get; set; }
        public string GroupName { get; set; }
        public List<ImageInput> Images { get; set; }
    }

    public class ImageInput
    {
        public string ImageType { get; set; }
        public string ImageUrl { get; set; }

        public ImageInput(string imageType, string imageUrl)
        {
            ImageType = imageType;
            ImageUrl = imageUrl;
        }
    }
}
