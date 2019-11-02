using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Hubs;
using Karaoke.Models;
using Microsoft.EntityFrameworkCore;

namespace Karaoke.Services {
    class KaraokeService : IKaraokeService {
        private readonly KaraokeContext context;
        public readonly IYoutubeService youtubeService;
        private readonly YoutubeHub hub;

        public KaraokeService (KaraokeContext context, IYoutubeService youtubeService, YoutubeHub hub) {
            this.context = context;
            this.youtubeService = youtubeService;
            this.hub = hub;
        }

        public  bool AddSong (string songId) {
            System.Console.WriteLine ($"Song ID: {songId} from Karaoke Service");
            var song =  context.Songs
            .Include(p=>p.SongId)
            .Include(p=>p.Snippet)
            .FirstOrDefault(p => p.SongId.VideoId == songId);
            
            if (song != null) {
                System.Console.WriteLine ($"Searched song is: {song.Snippet.Title}");
                var  hubresult =  hub.SendSong (hub.Context.ConnectionId, song);
                return true;
            }
            return false;
        }

        public IEnumerable<Song> FindSongs (string keyword) {
            System.Console.WriteLine ($"Keyword: {keyword}");
            var songs = context.Songs
                .Include (p => p.SongId)
                .Include (p => p.Snippet)
                .AsNoTracking ()
                .Where (p => p.Snippet.Title.Contains (keyword));

            return songs;
        }

        public Task<bool> RemoveSong (string songId) {
            throw new System.NotImplementedException ();
        }

        public bool InitializeData () {
            var result = youtubeService.GetAllVideosFromFile ();
            try {
                var songsToAdd = result;
                if (songsToAdd.Any ()) {
                    context.Songs.AddRange (songsToAdd.Where (p => p.SongId.VideoId != null));
                }
            } catch (System.Exception e) {
                System.Console.WriteLine ("Unable to add songs..");
                System.Console.WriteLine ($"ERROR: {e.Message}");
                return false;
            }
            return true;
        }
    }
}