using Newtonsoft.Json;

namespace Archaios.AI.Shared.Models.Base
{
   public abstract class BaseEntity
   {
      [JsonProperty("id")]
      public string Id { get; set; } = Guid.NewGuid().ToString();
      [JsonProperty("createdAt")]
      public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
      [JsonProperty("updatedAt")]
      public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
   }
}
