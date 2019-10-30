using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Hubs;
using Karaoke.Models;

namespace Karaoke.Services {
    class KaraokeService : IKaraokeService {
        private readonly KaraokeContext context;
        public readonly YoutubeService youtubeService;
        private readonly YoutubeHub hub;

        public KaraokeService (KaraokeContext context, YoutubeService youtubeService, YoutubeHub hub) {
            this.context = context;
            this.youtubeService = youtubeService;
            this.hub = hub;
        }

        public async Task<bool> AddSong (string songId) {
            System.Console.WriteLine ($"Song ID: {songId} from Karaoke Service");
            await hub.SendSong (hub.Context.ConnectionId, songId);
            var song = context.Songs.FirstOrDefault (p => p.SongId == songId);

            return true;

        }

        public async Task<IEnumerable<Song>> FindSongs (string keyword) {
            System.Console.WriteLine ($"Keyword: {keyword}");
            return await youtubeService.Search (keyword);
        }

        public Task<bool> RemoveSong (string songId) {
            throw new System.NotImplementedException ();
        }
    }
}