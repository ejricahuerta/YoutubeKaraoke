using System.Collections.Generic;
using Karaoke.Entities;

namespace Karaoke.Services
{
    public interface IKaraokeService
    {
        IEnumerable<Song>  FindSongs(string keyword);
        bool AddSong(string songId);
        bool RemoveSong(string songId);
    }
}