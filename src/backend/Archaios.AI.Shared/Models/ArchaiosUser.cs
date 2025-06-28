using Archaios.AI.Shared.Models.Base;
using Newtonsoft.Json;

namespace Archaios.AI.Shared.Models
{
    public class ArchaiosUser : BaseEntity
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("username")]
        public string Username { get; set; }

        [JsonProperty("photoUrl")]
        public string PhotoUrl { get; set; }

        [JsonProperty("role")]
        public string Role { get; set; }

        [JsonProperty("oid")]
        public string Oid { get; set; }

        [JsonProperty("provider")]
        public string Provider { get; set; }
        [JsonProperty("isArchaeologist")]
        public bool IsArchaeologist { get; set; } = false;

    }
}
