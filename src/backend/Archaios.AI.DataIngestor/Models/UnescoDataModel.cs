using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.DataIngestor.Models
{
   public class Feature
   {
      public Properties properties { get; set; }
      public string type { get; set; }
      public Geometry geometry { get; set; }
   }

   public class Geometry
   {
      public string type { get; set; }
      public List<double> coordinates { get; set; }
   }

   public class Properties
   {
      public int id_no { get; set; }
      public int danger { get; set; }
      public string component_state { get; set; }
      public int cat { get; set; }
      public string title { get; set; }
      public int icon { get; set; }
      public string component_name { get; set; }
   }

   public class UnescoDataModel
   {
      public string allIds { get; set; }
      public string type { get; set; }
      public List<Feature> features { get; set; }
   }
}
