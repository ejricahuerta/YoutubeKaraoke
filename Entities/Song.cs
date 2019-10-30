using System.ComponentModel.DataAnnotations;

namespace Karaoke.Entities {
    public class Song {
        [Key]
        public int Id { get; set; }
        public string SongId { get; set; }
        public string Title { get; set; }
        public string Channel { get; set; }
        public string ChannelId { get; set; }
    }
}