using System.Collections.Generic;
using System.Threading.Tasks;
using Google.Apis.Services;
using Google.Apis.YouTube.v3;

namespace Karaoke.Services
{
    public class YoutubeService
    {
        private readonly List<string> Channels = new List<string> {
                "UCIk6z4gxI5ADYK7HmNiJvNg", "UCbzz_Y9oVH2-57G4k0awE0w", "UCWtgXQ8Rc7H309esXN2gkrw", "UCUfLW7fYnY3A-5HCLgcK0_w", "UCaPwSXblS8F0owlKHGc6huw"
        };

        public const string APIKEY = "AIzaSyBEPcHqL4xl5efNPPJqDOYR3_TkZ1ejTls";
        public YouTubeService YouTubeService  { get; set; }
        public YoutubeService()
        {
            YouTubeService = new YouTubeService(new BaseClientService.Initializer()
            {
                ApiKey = APIKEY,
                ApplicationName = this.GetType().ToString()
            });

        }

        // public Task Search(string keyword) {
        //     var searchRequest = YouTubeService.Search.List("snippet");
        //     searchRequest.Q = keyword;
        //     searchRequest.MaxResults = 5;

        //     var response = await  searchRequest.ExecuteAsync();

        // }

    }
}