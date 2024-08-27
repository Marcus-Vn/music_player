
const APIcontroller = (function() {
    let clientID; // Definido no escopo do módulo
    let clientSecret; // Definido no escopo do módulo

     // Função para buscar clientID e clientSecret
     const fetchClientData = async () => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                throw new Error('Erro na resposta da API: ' + response.status + ' ' + response.statusText);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error('Erro na API: ' + data.error);
            } else {
                clientID = data.clientID;
                clientSecret = data.clientSecret;

                // Confirmar se clientID e clientSecret são válidos
                if (!clientID || !clientSecret) {
                    throw new Error('clientID ou clientSecret não definidos');
                }
            }
        } catch (error) {
            console.error('Erro ao buscar clientID e clientSecret:', error);
        }
    };

    const redirectToSpotifyLogin = async () => {
        // Assegurar que as variáveis estejam carregadas
        await fetchClientData();

        if (!clientID) {
            console.error('clientID não está definido');
            return;
        }

        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
    }
    
    const redirectUri = 'http://localhost:3000';
    const scope = 'user-read-private user-read-email';

    // Inicialize o cliente
    (async () => {
        await fetchClientData();
    })();

    const _getToken = async (code) => {
        if (!clientID || !clientSecret) {
            console.error('clientID ou clientSecret não definidos');
            return;
        }

        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: 'POST',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientID + ':' + clientSecret)
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
        });

        if (!result.ok) {
            throw new Error(`Erro ao obter token: ${result.status} ${result.statusText}`);
        }

        const data = await result.json();
        console.log('Access Token:', data.access_token);
        return data.access_token;
        
    }

    const _getTracks = async (token, query) => {
        const initialLimit = 30;  // Solicitar mais faixas inicialmente para garantir que possamos filtrar
        const finalLimit = 10;    // O número final de faixas que queremos após o filtro

        const result = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${initialLimit}&market=US`, 
        {
            method: 'GET',
            headers: {'Authorization': 'Bearer ' + token}
        });

        const data = await result.json();
        console.log('Tracks Data:', data);

        // Filtra as faixas que têm preview disponível
        const tracksWithPreview = data.tracks.items.filter(track => track.preview_url);

        return tracksWithPreview.slice(0, finalLimit);
    }

    const _getUserProfile = async (token) => {
        const result = await fetch("https://api.spotify.com/v1/me", {
            method: 'GET',
            headers: {'Authorization': 'Bearer ' + token}
        });

        const data = await result.json();
        console.log('User Profile:', data);
        return data;
    }

    return {
        getToken(code) {
            return _getToken(code);
        },
        getUserProfile(token) {
            return _getUserProfile(token);
        },
        getTracks(token, query) {
            return _getTracks(token, query);
        },
        redirectToSpotifyLogin
    }

})();

document.addEventListener('DOMContentLoaded', () => {
    // Sua função aqui
    displayPlaylist(songs);
});

let player;
let spotifyDeviceId;

// Adicionando um event listener ao botão de login
document.getElementById('spotify-login-btn').addEventListener('click', function() {
    APIcontroller.redirectToSpotifyLogin();
});

// Verifica se há um código de autorização na URL após o redirecionamento
window.addEventListener('load', async () => {

    const code = new URLSearchParams(window.location.search).get('code');
    if(code){
        const token = await APIcontroller.getToken(code); //token de acesso
        const userProfile = await APIcontroller.getUserProfile(token);
        if(userProfile.display_name!=undefined){
            // Mostrar o nome do usuário na interface
            document.getElementById('user-info').style.display = 'block';
            document.getElementById('user-name').textContent = userProfile.display_name;
    
            // Mostrar o campo de pesquisa
            document.getElementById('search-container').style.display = 'flex';

            document.querySelector('#search-input').addEventListener('keypress', async function (e) {
                if (e.key === 'Enter') {
                    const query = document.getElementById('search-input').value;
                    if (query) {
                        try {
                            const tracks = await APIcontroller.getTracks(token, query);
                            displayResults(tracks);
                            displayPlaylist(songs);
                        } catch (error) {
                            console.error('Error getting tracks:', error);
                        }
                    }
                }
            });

            // Adicionar event listener ao botão de pesquisa
            document.getElementById('search-btn').addEventListener('click', async () => {
                const query = document.getElementById('search-input').value;
                if (query) {
                    const tracks = await APIcontroller.getTracks(token, query);
                    displayResults(tracks);
                    displayPlaylist(songs);
                }
            });


        }
    }else {
        //APIcontroller.redirectToSpotifyLogin();
    }
});

const displayResults = (tracks) => {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    tracks.forEach(track => {
        const trackElement = document.createElement('div');
        trackElement.classList.add('track');
        trackElement.innerHTML = `
            <img src="${track.album.images[0]?.url}" alt="${track.name}" style="width: 50px; height: 50px;">
            <div>
                <strong>${track.name}</strong><br>
                Artist: ${track.artists[0]?.name}
            </div>
            <button class="add-song-btn" data-name="${track.name}" data-artist="${track.artists[0]?.name}" data-cover="${track.album.images[0]?.url}" data-path="${track.preview_url}">
                <i class="fa-solid fa-plus"></i>
            </button>
        `;
        resultsContainer.appendChild(trackElement);
    });

    document.getElementById('results-container').style.display = 'block';

    // Adicionar event listeners aos botões de adicionar música
    document.querySelectorAll('.add-song-btn').forEach(button => {
        button.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            const artist = this.getAttribute('data-artist');
            const cover = this.getAttribute('data-cover');
            const path = this.getAttribute('data-path');

            addSongToList({
                path,
                displayName: name,
                cover,
                artist
            });
        });
    });
};

const displayPlaylist = (songs) => {
    const playContainer = document.getElementById('playlist');
    playContainer.innerHTML = ''; // Limpa o conteúdo existente

    songs.forEach((song, index) => {
        const trackElement = document.createElement('div');
        trackElement.classList.add('tracklist');

        // Adiciona o conteúdo HTML para cada faixa
        trackElement.innerHTML = `
            <img src="${song.cover}" alt="${song.displayName}" class="track-cover" style="width: 50px; height: 50px;">
            <div class="track-info">
                <strong>${song.displayName}</strong><br>
                Artist: ${song.artist}
            </div>
            <button class="rmv-song-btn" 
                data-index="${index}">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        // Adiciona o evento de clique à capa e ao texto
        const coverElement = trackElement.querySelector('.track-cover');
        const infoElement = trackElement.querySelector('.track-info');
        
        coverElement.addEventListener('click', () => {
            playSong(index); // Função que inicia a música
        });

        infoElement.addEventListener('click', () => {
            playSong(index); // Função que inicia a música
        });

        // Adiciona o elemento da faixa ao container
        playContainer.appendChild(trackElement);
    });

    // Adiciona o listener para todos os botões de remoção
    const removeButtons = document.querySelectorAll('.rmv-song-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const songIndex = event.currentTarget.getAttribute('data-index');
            removeSongFromList(songIndex);
        });
    });

    if(alreadyPlay){
        const tracks = document.querySelectorAll('.tracklist');
        tracks.forEach(track => {
            track.classList.remove('playing');
        });
        // Adiciona a classe 'playing' à faixa que está tocando
        tracks[musicIndex].classList.add('playing');
    }
}

const playSong = (index) => {
    // Primeiro, remove a classe 'playing' de todas as faixas
    const tracks = document.querySelectorAll('.tracklist');
    tracks.forEach(track => {
        track.classList.remove('playing');
    });

    // Adiciona a classe 'playing' à faixa que está tocando
    tracks[index].classList.add('playing');

    musicIndex = index;
    loadMusic(songs[musicIndex]);
    playMusic()
}

const removeSongFromList = (index) => {
    console.log(index);
    console.log(songs.length-1);

    if(index == musicIndex && index == songs.length-1){
        changeMusic(-songs.length+1);
        // Remove a música da lista songs pelo índice
        songs.splice(index, 1);
        displayPlaylist(songs); // Atualiza a lista exibida
        // Primeiro, remove a classe 'playing' de todas as faixas
        const tracks = document.querySelectorAll('.tracklist');
        tracks.forEach(track => {
            track.classList.remove('playing');
        });
        tracks[0].classList.add('playing');
    }else if(index == musicIndex){
        songs.splice(index, 1);
        displayPlaylist(songs); // Atualiza a lista exibida

        changeMusic(0);
        // Primeiro, remove a classe 'playing' de todas as faixas
        const tracks = document.querySelectorAll('.tracklist');
        tracks.forEach(track => {
            track.classList.remove('playing');
        });
        tracks[musicIndex].classList.add('playing');
    }else if(index < musicIndex){
        musicIndex-=1;

        songs.splice(index, 1);
        displayPlaylist(songs); // Atualiza a lista exibida

        // Primeiro, remove a classe 'playing' de todas as faixas
        const tracks = document.querySelectorAll('.tracklist');
        tracks.forEach(track => {
            track.classList.remove('playing');
        });
        tracks[musicIndex].classList.add('playing');
    }else{
        songs.splice(index, 1);
        displayPlaylist(songs); // Atualiza a lista exibida
        // Primeiro, remove a classe 'playing' de todas as faixas
        const tracks = document.querySelectorAll('.tracklist');
        tracks.forEach(track => {
            track.classList.remove('playing');
        });
        tracks[musicIndex].classList.add('playing');
    }
}

const addSongToList = (song) => {
    // Adiciona a nova música à lista songs
    songs.push(song);
    displayPlaylist(songs);
};

const image = document.getElementById('cover'),
    title = document.getElementById('music-title'),
    artist = document.getElementById('music-artist'),
    currentTimeEl = document.getElementById('current-time'),
    durationEl = document.getElementById('duration'),
    progress = document.getElementById('progress'),
    playerProgress = document.getElementById('player-progress'),
    prevBtn = document.getElementById('prev'),
    nextBtn = document.getElementById('next'),
    playBtn = document.getElementById('play'),
    background = document.getElementById('bg-img');

const music = new Audio();

const songs = [
    {
        path: 'assets/caughtinthemiddle.mp3',
        displayName: 'Caught in the Middle',
        cover: 'assets/afterlaughter.jpg',
        artist: 'Paramore'
    },
    {
        path: 'assets/yellow.mp3',
        displayName: 'Yellow',
        cover: 'assets/Parachutes.jpg',
        artist: 'Coldplay'
    }
];

let musicIndex = 0;
let isPlaying = false;
let alreadyPlay = false;

function togglePlay() {
    // Primeiro, remove a classe 'playing' de todas as faixas
    const tracks = document.querySelectorAll('.tracklist');
    tracks.forEach(track => {
        track.classList.remove('playing');
    });
    tracks[musicIndex].classList.add('playing');
    if(isPlaying){
        pauseMusic();
    }else{
        playMusic();
    }
}

function playMusic() {
    isPlaying = true;
    alreadyPlay = true;

    playBtn.classList.replace('fa-play','fa-pause');
    playBtn.setAttribute('title','Pause');

    music.play();
}

function pauseMusic() {
    isPlaying = false;

    playBtn.classList.replace('fa-pause','fa-play');

    playBtn.setAttribute('title','Play');
    music.pause();
}

function loadMusic(song) {
    // Reproduzir música local
    music.src = song.path;
    title.textContent = song.displayName;
    artist.textContent = song.artist;
    image.src = song.cover;
    background.src = song.cover;
}

function changeMusic(direction) {
    // Primeiro, remove a classe 'playing' de todas as faixas
    const tracks = document.querySelectorAll('.tracklist');
    tracks.forEach(track => {
        track.classList.remove('playing');
    });
    
    musicIndex = (musicIndex + direction + songs.length) % songs.length;
    // Adiciona a classe 'playing' à faixa que está tocando
    tracks[musicIndex].classList.add('playing');
    loadMusic(songs[musicIndex]);
    playMusic();
}

function updateProgressBar() {
    const {duration, currentTime} = music;
    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;

    const formatTime = (time) => String(Math.floor(time)).padStart(2, '0');
    durationEl.textContent = `${formatTime(duration / 60)}:${formatTime(duration % 60)}`;
    currentTimeEl.textContent = `${formatTime(currentTime / 60)}:${formatTime(currentTime % 60)}`;
}

function setProgressBar (e) {
    const width = playerProgress.clientWidth;
    const clickX = e.offsetX;
    music.currentTime = (clickX / width) * music.duration;
}

playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => changeMusic(-1));
nextBtn.addEventListener('click', () => changeMusic(1));
music.addEventListener('ended', () => changeMusic(1));
music.addEventListener('timeupdate', updateProgressBar);
playerProgress.addEventListener('click', setProgressBar);

loadMusic(songs[musicIndex]);
