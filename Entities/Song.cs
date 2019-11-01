using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json;

namespace Karaoke.Entities {
    public class Song {
        [Key]
        [JsonIgnore]
        public int Id { get; set; }

        [JsonProperty ("videoId")]
        public string SongId { get; set; }

        [JsonProperty ("title")]
        public string Title { get; set; }

        [JsonProperty ("channelTitle")]
        public string Channel { get; set; }

        [JsonProperty ("channelId")]
        public string ChannelId { get; set; }

        [JsonIgnore]
        public bool OnQueue { get; set; } = false;
    }
}