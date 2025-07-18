﻿using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using System;
using System.ComponentModel;

namespace Archaios.AI.Shared
{

    public class CalendarPlugin
    {        
        public CalendarPlugin()
        {
            
        }
        
        [KernelFunction("GetCurrentDate")]
        [Description("Get the current date, year and month")]
        public string GetCurrentDate()
        {
            return DateTime.Now.Date.ToLongDateString();
        }
    }
}
