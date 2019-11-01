using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json;
using YouTubeKaraoke.Entities;

namespace Karaoke.Entities {
    public class Song {

        [Key]
        public int Id { get; set; }

        [JsonProperty ("id")]
        public SongId SongId { get; set; }

        [JsonProperty ("snippet")]

        public Snippet Snippet { get; set; }

        public bool OnQueue { get; set; } = false;

    }
}