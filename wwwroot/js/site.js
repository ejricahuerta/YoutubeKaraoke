// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.
var player;
var songList = []
var randomPlayer;
var isPlayerError = false;
var IsPlaying = false;
var listStyle = "list-group-item text-wrap"
var channelList = ["UCIk6z4gxI5ADYK7HmNiJvNg", "UCbzz_Y9oVH2-57G4k0awE0w", "UCWtgXQ8Rc7H309esXN2gkrw", "UCUfLW7fYnY3A-5HCLgcK0_w", "UCaPwSXblS8F0owlKHGc6huw"]
var list = {
    playlist: ["'racks Planet Karaoke"]
}

function onYouTubePlayerAPIReady() {

    player = new YT.Player('player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
    $(".message").addClass("d-none").removeClass("d-flex");
}


// autoplay video
function onPlayerReady(event) {
    event.target.playVideo();
}

// when video ends
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        IsPlaying = true;
        ShiftSongs();
    }
    if (event.data === 0) {
        var song = songList.pop();
        if (song) {
            console.log("song is valid");
            player.loadVideoById(song["songId"]);
        }
    }
}
function onPlayerError(event) {
    console.log('Error: ' + event.data);
    isPlayerError = true;
    player.stopVideo();
    var song = songList.pop();
    if (song) {
        console.log("song is valid");
    }
    player.loadVideoById(song["songId"]);
}


let connection = new signalR.HubConnectionBuilder().withUrl("/hub").build();

connection.on("UpdateSong", function (user, song) {
    console.log("requested by : " + user)
    console.log(JSON.stringify(song))
    console.log(song["title"])
    var playingIsEmpty = $(".playing").hasClass("d-none");
    console.log("playing song is empty." + playingIsEmpty);
    var QueueIsEmpty = $(".list").hasClass("d-none");
    console.log("queue song is empty " + QueueIsEmpty);
    if (playingIsEmpty) {
        if (!IsPlaying) {
            $(".playing").removeClass("d-none");
            $(".song-title").text(song["title"]);
            player.loadVideoById(song["songId"]);
        }
    }
    else {
        songList.unshift([song]);
        $(".list-group").append("<li class=" + listStyle + ">" + song["title"] + "</li>");
    }

});

connection.start().then(function () {
    console.log("connection started!");
}).catch(function (err) {
    return console.error(err.toString());
});



function ShiftSongs(params) {
    $(".playing").hasClass("d-none")
}