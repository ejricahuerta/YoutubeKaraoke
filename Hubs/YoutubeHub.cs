using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Services;
using Microsoft.AspNetCore.SignalR;

namespace Karaoke.Hubs {
    public class YoutubeHub : Hub {

        public YoutubeHub () {

        }
        public async Task SendSong (string user, Song song) {
            System.Console.WriteLine ("Fired!");
            await Clients.All.SendAsync ("UpdateSong", user, song);
        }

    }
}