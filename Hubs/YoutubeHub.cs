using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace Karaoke.Hubs
{
    public class YoutubeHub : Hub
    {
        public async Task SendMessage(string user, string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", user, message);
        }
    }
}