using System.Collections.Generic;
using System.Threading.Tasks;
using Karaoke.Entities;

namespace Karaoke.Services {
    public interface IKaraokeService {
        bool InitializeData ();
        IEnumerable<Song> FindSongs (string keyword);
        bool AddSong (string songId);
        Task<bool> RemoveSong (string songId);
    }
}