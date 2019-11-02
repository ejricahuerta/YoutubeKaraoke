// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.
let listStyle = "list-group-item";
let connection = new signalR.HubConnectionBuilder().withUrl("/hub").build();

var player;
var songList = []
var IsPlaying = false;

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubePlayerAPIReady() {
    player = new YT.Player('player', {
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

function stopVideo() {
    player.stopVideo();
    IsPlaying = false;
}



// when video ends
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        IsPlaying = true;
    }
    if (event.data == YT.PlayerState.ENDED) {
        console.log("song left: " + songList.length);
        var song = ShiftSongs();
        if (song) {
            console.log("playing next song..")
            player.loadVideoById(song["songId"]);
        }
    }
}


function onPlayerError(event) {
    IsPlaying = false;
    console.log('Error: ' + event.data);
    player.stopVideo();
    var song = ShiftSongs();
    player.loadVideoById(song["songId"]);

}

function ShiftSongs() {
    //check if list is not null;
    var popped;
    if (songList.length != 0) {
        popped = songList.pop();
        $(".song-title").text(popped["title"]);
        $(".list-group").empty();
        songList.forEach(e => {
            var item = "<li class=" + listStyle + ">" + e["title"] + "</li>"
            $(".list-group").append(item)
        });

    } else {


    }
    return popped;
}


connection.on("UpdateSong", function (user, song) {
    console.log("requested by : " + user)
    console.log(song["title"])
    console.log(song["songId"])
    if (song) {
        songList.unshift(song);
        if (IsPlaying) {
            var item = "<li class=" + listStyle + ">" + song["title"] + "</li>"
            $(".list-group").append(item)
        } else {
            var next = ShiftSongs();
            $(".song-title").text(next["title"]);
            player.loadVideoById(next["songId"]);
        }
    };
});

$(function () {
    connection.start().then(function () {
        console.log("connection started!");
    }).catch(function (err) {
        return console.error(err.toString());
    });
})