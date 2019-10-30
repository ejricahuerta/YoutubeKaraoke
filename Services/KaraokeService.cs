using System.Collections.Generic;
using Karaoke.Entities;
using Karaoke.Models;

namespace Karaoke.Services
{
    class KaraokeService : IKaraokeService
    {
        public KaraokeService(KaraokeContext context)
        {

        }
        public bool AddSong(string songId)
        {
            throw new System.NotImplementedException();
        }

        public IEnumerable<Song> FindSongs(string keyword)
        {
            throw new System.NotImplementedException();
        }

        public bool RemoveSong(string songId)
        {
            throw new System.NotImplementedException();
        }
    }
}