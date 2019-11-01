using Newtonsoft.Json;

namespace Karaoke.Entities {
    public class SongId {
        public int Id { get; set; }

        [JsonProperty ("videoId")]
        public string VideoId { get; set; }
    }
}