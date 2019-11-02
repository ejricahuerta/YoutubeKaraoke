using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Services;
using Microsoft.AspNetCore.SignalR;

namespace Karaoke.Hubs {
    public class YoutubeHub : Hub {

        public YoutubeHub () {

        }
        public async Task SendSong (string user, Song song) {
            var songToPush = new SongSearched {
                Title = song.Snippet.Title,
                SongId = song.SongId.VideoId,
            };
            System.Console.WriteLine ("Fired!");
            await Clients.All.SendAsync ("UpdateSong", user, songToPush);
        }

    }
    class SongSearched
    {
        public int Id { get; set; }
        public string SongId { get; set; }
        public string Title { get; set; }
    
    }
}