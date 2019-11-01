using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Google.Apis.Services;
using Google.Apis.YouTube.v3;
using Karaoke.Entities;

namespace Karaoke.Services
{
    public interface IYoutubeService
    {
        YouTubeService YouTubeService { get; set; }

        IEnumerable<Song> GetAllVideos();
        Task<IList<Song>> Search(string keyword);
    }

    public class YoutubeService : IYoutubeService
    {
        private readonly List<string> Channels = new List<string> {
            "UCIk6z4gxI5ADYK7HmNiJvNg",
            "UCbzz_Y9oVH2-57G4k0awE0w",
            "UCWtgXQ8Rc7H309esXN2gkrw",
            "UCUfLW7fYnY3A-5HCLgcK0_w",
            "UCaPwSXblS8F0owlKHGc6huw"
        };

        public List<string> ChannelIDs = new List<string>{"UCIk6z4gxI5ADYK7HmNiJvNg",
         "UCbzz_Y9oVH2-57G4k0awE0w",
          "UCWtgXQ8Rc7H309esXN2gkrw",
          "UCUfLW7fYnY3A-5HCLgcK0_w",
           "UCaPwSXblS8F0owlKHGc6huw"};


        public const string APIKEY = "AIzaSyBEPcHqL4xl5efNPPJqDOYR3_TkZ1ejTls";
        public YouTubeService YouTubeService { get; set; }
        public YoutubeService()
        {
            YouTubeService = new YouTubeService(new BaseClientService.Initializer()
            {
                ApiKey = APIKEY,
                ApplicationName = this.GetType().ToString()
            });

        }

        public async Task<IList<Song>> Search(string keyword)
        {

            List<Song> songs = new List<Song>();
            var searchListRequest = YouTubeService.Search.List("snippet");
            searchListRequest.MaxResults = 50;
            var result = await searchListRequest.ExecuteAsync();
            if (result.Items.Count > 0)
            {
                System.Console.WriteLine("Has Result");
            }
            foreach (var video in result.Items)
            {
                if (video.Id.Kind == "youtube#video")
                {
                    System.Console.WriteLine($"result VideoId: {video.Id.VideoId}");
                    songs.Add(
                        new Song
                        {
                            SongId = video.Id.VideoId,
                            Title = video.Snippet.Title,
                            Channel = video.Snippet.ChannelTitle,
                            ChannelId = video.Snippet.ChannelId
                        });
                }
            }
            System.Console.WriteLine($"song result: { songs.Count() }");

            return songs;
        }
        public IEnumerable<Song> GetAllVideos()
        {

            List<Song> songs = new List<Song>();
            string pageToken = "replaceMe";
            bool isFirst = true;
            foreach (var channel in Channels)
            {
                
                    var searchListRequest = YouTubeService.Search.List("snippet");
                    if (isFirst)
                    {
                        pageToken = null;
                        isFirst = false;
                    }
                    pageToken = null;
                    System.Console.WriteLine($"Channel ID: {channel}");
                    System.Console.WriteLine($"Next Page Token : {pageToken}");

                    searchListRequest.ChannelId = channel;
                    searchListRequest.PageToken = pageToken;
                    var result = searchListRequest.ExecuteAsync().Result;
                    foreach (var video in result.Items)
                    {
                        songs.Add(
                            new Song
                            {
                                SongId = video.Id.VideoId,
                                Title = video.Snippet.Title,
                                Channel = video.Snippet.ChannelTitle,
                                ChannelId = video.Snippet.ChannelId
                            });
                    }

                    if (result.NextPageToken != null)
                    {
                        pageToken = result.NextPageToken;
                    }
                    else{
                        isFirst = true;
                    }

                

            }
            System.Console.WriteLine($"Total Songs: {songs.Count()}");
            System.Console.WriteLine(".............................");
            foreach (var song in songs)
            {
                System.Console.WriteLine($"{ song.SongId}");
                System.Console.WriteLine($"{song.Title}");
                System.Console.WriteLine($"{song.ChannelId}");
                System.Console.WriteLine($"{song.Channel}");
                System.Console.WriteLine("----------------------");
            }
            return songs;
        }

    }
}