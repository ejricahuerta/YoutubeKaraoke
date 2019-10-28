// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.
var player;
var songList = ["_BJo7YA9tno"]
function onYouTubePlayerAPIReady() {
    player = new YT.Player('video', {
      videoId: '0Bmhjf0rKe8',
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
}

// autoplay video
function onPlayerReady(event) {
    event.target.playVideo();
}

// when video ends
function onPlayerStateChange(event) {        
    if(event.data === 0) {            
        if(songList === undefined || songList.length == 0) {
            console.log("No songs available");
            alert("song done..")
        }
        else{
           var videoId = songList[songList.length-1];
           player.loadVideoById(videoId)
        }
    }
}

