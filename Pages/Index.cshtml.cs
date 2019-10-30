using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Karaoke.Pages {

    public class IndexModel : PageModel {

        private readonly IKaraokeService karaokeService;
        public IndexModel (IKaraokeService karaokeService) {
            this.karaokeService = karaokeService;
        }

        public string URL { get; set; } = "http://localhost:5000";

        [BindProperty (SupportsGet = true)]
        public string Search { get; set; }
        public IList<Song> Songs { get; set; } = new List<Song> ();

        [BindProperty (SupportsGet = true)]
        public string SongId { get; set; }

        public bool HasAdded { get; set; } = false;
        public async Task<IActionResult> OnGet (string SongId = null) {
            if (!string.IsNullOrEmpty (Search)) {
                var songs = await karaokeService.FindSongs (Search);
                Songs = songs.ToList ();
                foreach (var song in Songs) {
                    System.Console.WriteLine ($"Song ID: {song.SongId}");
                }
            } else if (!string.IsNullOrEmpty (SongId)) {
                System.Console.WriteLine ($"Song ID: {SongId}");
                var result = await karaokeService.AddSong (SongId);
                if (result) {
                    HasAdded = true;
                }
            }

            return Page ();
        }
    }
}