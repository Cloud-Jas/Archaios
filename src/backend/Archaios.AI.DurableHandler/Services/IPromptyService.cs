using Microsoft.SemanticKernel;

namespace Archaios.AI.DurableHandler.Services
{
   public interface IPromptyService
   {
      Task<string> RenderPromptAsync(string filePath, Kernel kernel, KernelArguments? arguments = null);
      Task<KernelFunction> GetKernelFuntionAsync(string filePath, Kernel kernel, KernelArguments? arguments);
   }

}
