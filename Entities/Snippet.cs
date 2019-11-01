using Newtonsoft.Json;

namespace YouTubeKaraoke.Entities {
    public class Snippet {
        public int Id { get; set; }

        [JsonProperty ("title")]
        public string Title { get; set; }

        [JsonProperty ("channelTitle")]
        public string Channel { get; set; }

        [JsonProperty ("channelId")]
        public string ChannelId { get; set; }

    }
}