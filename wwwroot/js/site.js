// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.
var player;
var songList = []
var scoreList = []
var randomPlaylist = []
var randomPlayer;
var  isPlayerError = false;
var listStyle = "list-group-item text-wrap"
var channelList = ["UCIk6z4gxI5ADYK7HmNiJvNg", "UCbzz_Y9oVH2-57G4k0awE0w", "UCWtgXQ8Rc7H309esXN2gkrw", "UCUfLW7fYnY3A-5HCLgcK0_w", "UCaPwSXblS8F0owlKHGc6huw"]
var list = {
    playlist: ["'racks Planet Karaoke"]
}

function onYouTubePlayerAPIReady() {
    if (songList.length === 0) {
        $("#player").addClass("d-none");
        randomPlayer = setTimeout(function () {
                $("#player").removeClass("d-none");
                player = new YT.Player('player', {
                    playerVars: {
                        listType: 'playlist',
                        list: randomPlaylist,
                        autoplay: 1
                    },
                    events: {
                        'onReady': onPlayerReady,
                        'onStateChange': onPlayerStateChange
                    }
                });
                $(".message").addClass("d-none").removeClass("d-flex");
            },
            1000)

    } else {
        clearTimeout(randomPlayer);
        player = new YT.Player('player', {
            videoId: songList.pop()["songId"],
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
        $(".message").addClass("d-none").removeClass("d-flex");
    }
}

// autoplay video
function onPlayerReady(event) {
    event.target.playVideo();
}

// when video ends
function onPlayerStateChange(event) {
    if (event.data === 0) {
        if (songList === undefined || songList.length == 0) {
            $("#message").removeClass("d-none")
        } else {
            var videoId = songList.pop();
            player.loadVideoById(videoId)
        }
    }
}

function onPlayerError(event) {
    console.log('Error: '+event.data);
    isPlayerError = true;
    player.stopVideo();
    player.loadVideoById(songList.pop()["songId"]);
  }


let connection = new signalR.HubConnectionBuilder().withUrl("/hub").build();

connection.on("UpdateSong", function (user, song) {
    console.log("requested by : " + user)
    console.log(JSON.stringify(song))
    songList.push(song["songId"]);
    console.log(song["title"])
    var NextIsEmpty = $(".next-song").hasClass("d-none");
    console.log("next song is empty." + NextIsEmpty);
    var QueueIsEmpty = $(".list").hasClass("d-none");
    console.log("queue song is empty " + QueueIsEmpty);
    if(NextIsEmpty && QueueIsEmpty) {
        $(".next-song").removeClass("d-none");
         $(".song-title").text(song["title"]);
    }
    else if(!NextIsEmpty && QueueIsEmpty){
        $(".list").removeClass("d-none");
        $(".list-group").append("<li class="+ listStyle+">" +song["title"] + "</li>");
    }
    else {
        $(".list-group").append("<li class="+ listStyle+">" +song["title"] + "</li>");
    }
    if(isPlayerError) {
        player.loadVideoById(songList.pop()["songId"]);
        isPlayerError = false;
    }
});

connection.start().then(function () {
    console.log("connection started!");
}).catch(function (err) {
    return console.error(err.toString());
});