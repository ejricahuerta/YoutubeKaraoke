using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Google.Apis.Services;
using Google.Apis.YouTube.v3;
using Karaoke.Entities;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Karaoke.Services {
    public interface IYoutubeService {
        YouTubeService YouTubeService { get; set; }

        IEnumerable<Song> GetAllVideos ();
        ICollection<Song> GetAllVideosFromFile ();
        Task<IList<Song>> Search (string keyword);
    }

    public class YoutubeService : IYoutubeService {
        private readonly List<string> Channels = new List<string> {
            "UCIk6z4gxI5ADYK7HmNiJvNg",
            "UCbzz_Y9oVH2-57G4k0awE0w",
            "UCWtgXQ8Rc7H309esXN2gkrw",
            "UCUfLW7fYnY3A-5HCLgcK0_w",
            "UCaPwSXblS8F0owlKHGc6huw"
        };

        public List<string> ChannelIDs = new List<string> {
            "UCIk6z4gxI5ADYK7HmNiJvNg",
            "UCbzz_Y9oVH2-57G4k0awE0w",
            "UCWtgXQ8Rc7H309esXN2gkrw",
            "UCUfLW7fYnY3A-5HCLgcK0_w",
            "UCaPwSXblS8F0owlKHGc6huw"
        };

        public const string APIKEY = "AIzaSyBEPcHqL4xl5efNPPJqDOYR3_TkZ1ejTls";
        public const string APIKEY2 = "AIzaSyDJv5G1Df6gr3eT7Dc9kgAwRKroLnpohIc";
        public YouTubeService YouTubeService { get; set; }
        public YoutubeService () {
            YouTubeService = new YouTubeService (new BaseClientService.Initializer () {
                ApiKey = APIKEY2,
                    ApplicationName = this.GetType ().ToString ()
            });

        }

        public async Task<IList<Song>> Search (string keyword) {

            List<Song> songs = new List<Song> ();

            var searchListRequest = YouTubeService.Search.List ("snippet");
            searchListRequest.MaxResults = 50;
            var result = await searchListRequest.ExecuteAsync ();
            if (result.Items.Count > 0) {
                System.Console.WriteLine ("Has Result");
            }
            foreach (var video in result.Items) {
                if (video.Id.Kind == "youtube#video") {
                    System.Console.WriteLine ($"result VideoId: {video.Id.VideoId}");
                    songs.Add (
                        new Song {
                            SongId = video.Id.VideoId,
                                Title = video.Snippet.Title,
                                Channel = video.Snippet.ChannelTitle,
                                ChannelId = video.Snippet.ChannelId
                        });
                }
            }
            System.Console.WriteLine ($"song result: { songs.Count() }");

            return songs;
        }
        public IEnumerable<Song> GetAllVideos () {

            List<Song> songs = new List<Song> ();
            try {

                var searchListRequest = YouTubeService.Search.List ("snippet");
                searchListRequest.MaxResults = 10;
                foreach (var channel in Channels) {
                    System.Console.WriteLine ($"Channel ID: {channel}");

                    searchListRequest.ChannelId = channel;

                    var pageToken = string.Empty;
                    //Request
                    searchListRequest.PageToken = pageToken;
                    //Get Response
                    var result = searchListRequest.ExecuteAsync ().Result;
                    if (result == null) {

                    } else {
                        //convert response to SONG obj
                        foreach (var video in result.Items) {
                            //Add to lists of SONGS
                            songs.Add (
                                new Song {
                                    SongId = video.Id.VideoId,
                                        Title = video.Snippet.Title,
                                        Channel = video.Snippet.ChannelTitle,
                                        ChannelId = video.Snippet.ChannelId
                                });
                        }

                    }
                }
            } catch (System.Exception e) {

                System.Console.WriteLine (e.Message);
            }
            System.Console.WriteLine ($"Total Songs: {songs.Count()}");
            System.Console.WriteLine (".............................");
            foreach (var song in songs) {
                System.Console.WriteLine ($"{ song.SongId}");
                System.Console.WriteLine ($"{song.Title}");
                System.Console.WriteLine ($"{song.ChannelId}");
                System.Console.WriteLine ($"{song.Channel}");
                System.Console.WriteLine ("----------------------");
            }
            return songs;
        }

        public ICollection<Song> GetAllVideosFromFile () {
            var songs = new List<Song> ();
            var files = new List<string> {
                @"first.json",
                @"second.json",
                @"third.json",
                @"fourth.json",
                @"fifth.json",

            };

            try {
                foreach (var item in files) {
                    var json = File.ReadAllText (item);
                    var songRoot = JsonConvert.DeserializeObject<List<SongRoot>> (json);
                    foreach (var root in songRoot) {
                        songs.AddRange (root.Songs);
                    }
                }

            } catch (System.Exception e) {
                System.Console.WriteLine ("Unable to Process files");
                System.Console.WriteLine ($"Error:\n {e}");
            }
            return songs;
        }

    }
}