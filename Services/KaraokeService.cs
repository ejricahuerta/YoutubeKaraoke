using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Hubs;
using Karaoke.Models;

namespace Karaoke.Services
{
    class KaraokeService : IKaraokeService
    {
        private readonly KaraokeContext context;
        public readonly IYoutubeService youtubeService;
        private readonly YoutubeHub hub;

        public KaraokeService(KaraokeContext context, IYoutubeService youtubeService, YoutubeHub hub)
        {
            this.context = context;
            this.youtubeService = youtubeService;
            this.hub = hub;
        }

        public async Task<bool> AddSong(string songId)
        {
            System.Console.WriteLine($"Song ID: {songId} from Karaoke Service");
            var song = context.Songs.FirstOrDefault(p => p.SongId == songId);
            if (song != null)
            {
                System.Console.WriteLine($"Searched song is: {song.Title}");
                await hub.SendSong(hub.Context.ConnectionId, song);
            return true;
            }
            return false;

        }

        public async Task<IEnumerable<Song>> FindSongs(string keyword)
        {
            System.Console.WriteLine($"Keyword: {keyword}");
            var songs = await youtubeService.Search(keyword);
            if (songs != null)
            {
                try
                {
                    context.Songs.AddRange(songs);
                }
                catch (System.Exception)
                {
                    return null;
                }
                finally
                {
                     context.SaveChanges();
                }
            }
            return songs;
        }

        public Task<bool> RemoveSong(string songId)
        {
            throw new System.NotImplementedException();
        }

        public  bool InitializeData()
        {
                var result =   youtubeService.GetAllVideos();
            try
            {
                var songsToAdd = result;
                if(songsToAdd.Any()) {
                    context.Songs.AddRange(songsToAdd);
                    context.SaveChanges();
                }
            }
            catch (System.Exception e)
            {
                System.Console.WriteLine("Unable to add songs..");
                System.Console.WriteLine($"ERROR: {e.Message}");
                return false;
            }
          
            return true;
        }
    }
}