using System.Collections.Generic;
using System.Threading.Tasks;
using Karaoke.Entities;

namespace Karaoke.Services {
    public interface IKaraokeService {
        Task<IEnumerable<Song>> FindSongs (string keyword);
        Task<bool> AddSong (string songId);
        Task<bool> RemoveSong (string songId);
    }
}