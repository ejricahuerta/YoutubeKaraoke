// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.
var player;
var songList = ["EAkIjq46Rlg"]
var scoreList = []
var randomPlaylist = []
var randomPlayer;
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
            videoId: songList.pop(),
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
            var videoId = songList[songList.length - 1];
            player.loadVideoById(videoId)
        }
    }
}

let connection = new signalR.HubConnectionBuilder().withUrl("/hub").build();

connection.on("ReceiveMessage", function (user, message) {
    songList
});

connection.start().then(function(){
    console.log("connection started!");
}).catch(function (err) {
    return console.error(err.toString());
});


