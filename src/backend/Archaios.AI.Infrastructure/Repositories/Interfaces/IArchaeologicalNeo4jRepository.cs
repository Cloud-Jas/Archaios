using Archaios.AI.Shared.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface IArchaeologicalNeo4jRepository
    {
        Task CreateArchaeologicalSiteAsync(ArchaeologicalSite site);
        Task<ArchaeologicalSite> GetSiteByIdAsync(string siteId);
        Task UpdateArchaeologicalSiteComponentsAsync(List<SiteComponent> siteComponents);
        Task UpdateSiteAgentAnalysisAsync(string siteId, List<AgentChatMessage> messages);
        Task CreateConstraintsAsync();
        Task<List<ArchaeologicalSite>> GetAllSitesAsync();
        Task<List<ArchaeologicalSite>> GetHeritageSitesAsync();
        Task<List<ArchaeologicalSite>> GetArchaiosSitesAsync();
        Task UpdateSiteIsPossibleArchaeologicalStatus(string siteId, bool isPossibleArchaeologicalSite);
        Task LikeComponentAsync(string siteId, string componentId, string userId);
        Task UnlikeComponentAsync(string siteId, string componentId, string userId);
    }
}
