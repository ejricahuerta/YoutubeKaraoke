using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Karaoke.Entities;
using Karaoke.Services;

namespace Karaoke.Pages
{

    public class IndexModel : PageModel
    {
     
        private readonly IKaraokeService karaokeService;
        public IndexModel(IKaraokeService karaokeService)
        {
            this.karaokeService = karaokeService;
        }

        public string URL { get; set; } = "http://localhost:5000";
        public string Search { get; set; }
        public IList<Song> Song { get; set; }
        public void OnGet()
        {
            
        }
    }
}