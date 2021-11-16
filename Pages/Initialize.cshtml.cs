using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Karaoke.Pages
{
    public class InitializeModel : PageModel
    {
        private readonly IKaraokeService service;

        public bool Success { get; set; } = false;
        public InitializeModel(IKaraokeService service)
        {
            this.service = service;
        }
        public IActionResult OnGet()
        {
            Success =  service.InitializeData();
            if (Success)
            {
                return Redirect("/");
            }
            return Page();
        }
    }
}
