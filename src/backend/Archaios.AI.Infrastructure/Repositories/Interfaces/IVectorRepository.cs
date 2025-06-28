using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface IVectorRepository
    {
        Task<List<dynamic>> FetchDetailsFromVectorSemanticLayer(ReadOnlyMemory<float> embedding,string prompt, string containerId="");
    }
}
