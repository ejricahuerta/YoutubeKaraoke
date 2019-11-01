using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Karaoke.Entities {
    public class SongRoot {
        [JsonProperty ("items")]
        public ICollection<Song> Songs { get; set; }
    }
}