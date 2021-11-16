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


        [BindProperty (SupportsGet = true)]
        public string Search { get; set; }
        public IList<Song> Songs { get; set; } = new List<Song> ();

        [BindProperty (SupportsGet = true)]
        public string SongId { get; set; }

        public bool HasAdded { get; set; } = false;
        public bool SongAdded { get; private set; }

        public IActionResult OnGet (string SongId = null) {

            if (!string.IsNullOrEmpty (Search)) {
                var songs = karaokeService.FindSongs (Search);
                Songs = songs.ToList ();
                foreach (var song in Songs) {
                    System.Console.WriteLine ($"Song ID: {song.SongId.Id}");
                }
            }

            if(!string.IsNullOrEmpty(SongId)){
                var added =  karaokeService.AddSong(SongId);
                SongAdded =added;
            }
            return Page ();
        }
    }
}