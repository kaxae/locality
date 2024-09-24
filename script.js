document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    const musicList = document.getElementById('music-list');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const libraryList = document.getElementById('library-list');
    const navItems = document.querySelectorAll('.nav-items a');
    const playerContainer = document.querySelector('.player-container');
    const playPauseBtn = document.getElementById('play-pause');
    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    const currentTime = document.querySelector('.current-time');
    const totalTime = document.querySelector('.total-time');
    const contextMenu = document.querySelector('.context-menu');
    const previousBtn = document.getElementById('previous');
    const nextBtn = document.getElementById('next');

    let db;
    let musicLibrary = [];
    let currentAudio = null;
    let currentMusicItem = null;
    let playQueue = [];

    // Open IndexedDB
    const dbName = "LocalityMusicDB";
    const dbVersion = 1;
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log("IndexedDB opened successfully");
        loadMusicFromDB();
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        const objectStore = db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("name", "name", { unique: false });
        objectStore.createIndex("artist", "artist", { unique: false });
    };

    fileUpload.addEventListener('change', handleFileUpload);
    searchInput.addEventListener('input', handleSearch);
    navItems.forEach(item => item.addEventListener('click', handleNavigation));
    playPauseBtn.addEventListener('click', togglePlayPause);
    progressBar.addEventListener('click', seek);
    document.addEventListener('click', hideContextMenu);
    previousBtn.addEventListener('click', playPreviousSong);
    nextBtn.addEventListener('click', playNextSong);

    // Add mobile navigation
    const mobileNav = document.createElement('nav');
    mobileNav.className = 'mobile-nav';
    mobileNav.innerHTML = `
        <ul>
            <li><a href="#" data-view="home">Home</a></li>
            <li><a href="#" data-view="search">Search</a></li>
            <li><a href="#" data-view="library">Library</a></li>
        </ul>
    `;
    document.body.appendChild(mobileNav);

    // Update navigation event listeners
    const allNavItems = document.querySelectorAll('.nav-items a, .mobile-nav a');
    allNavItems.forEach(item => item.addEventListener('click', handleNavigation));

    // Add touch event listeners for seeking on mobile
    progressBar.addEventListener('touchstart', handleTouchSeek);
    progressBar.addEventListener('touchmove', handleTouchSeek);

    function handleTouchSeek(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const boundingRect = progressBar.getBoundingClientRect();
        const percent = (touch.clientX - boundingRect.left) / boundingRect.width;
        if (currentAudio) {
            currentAudio.currentTime = percent * currentAudio.duration;
            updateProgress();
        }
    }

    function handleFileUpload(event) {
        const files = event.target.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('audio/')) {
                readMusicFile(file);
            }
        }
        event.target.value = '';
        
        if (currentAudio) {
            resetAudioContext();
        }
    }

    function resetAudioContext() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        if (currentMusicItem) {
            currentMusicItem.classList.remove('playing');
            currentMusicItem = null;
        }
        playerContainer.classList.remove('active');
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    function readMusicFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    const musicData = {
                        id: Date.now() + Math.random(), // Generate a unique ID
                        name: tag.tags.title || file.name,
                        duration: 0,
                        type: file.type,
                        data: e.target.result,
                        albumArt: 'placeholder.png'
                    };

                    const audio = new Audio(e.target.result);
                    audio.addEventListener('loadedmetadata', () => {
                        musicData.duration = formatDuration(audio.duration);
                        saveMusicFile(musicData);
                    });
                },
                onError: function(error) {
                    console.log('Error reading tags:', error.type, error.info);
                    const musicData = {
                        id: Date.now() + Math.random(), // Generate a unique ID
                        name: file.name,
                        duration: 0,
                        type: file.type,
                        data: e.target.result,
                        albumArt: 'placeholder.png'
                    };
                    saveMusicFile(musicData);
                }
            });
        };
        reader.readAsDataURL(file);
    }

    function saveMusicFile(musicData) {
        const transaction = db.transaction(["songs"], "readwrite");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.add(musicData);

        request.onsuccess = (event) => {
            console.log("Music file added to IndexedDB");
            musicData.id = event.target.result; // Store the generated ID
            musicLibrary.push(musicData);
            addMusicToUI(musicData, musicList);
            addMusicToUI(musicData, libraryList);
        };

        request.onerror = (event) => {
            console.error("Error adding music file to IndexedDB:", event.target.error);
        };
    }

    function loadMusicFromDB() {
        const transaction = db.transaction(["songs"], "readonly");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.getAll();

        request.onerror = (event) => {
            console.error("Error loading music from IndexedDB:", event.target.error);
        };

        request.onsuccess = (event) => {
            musicLibrary = event.target.result;
            console.log("Music library loaded from IndexedDB:", musicLibrary);
            displayMusicLibrary();
        };
    }

    function displayMusicLibrary() {
        musicList.innerHTML = ''; // Clear existing list
        musicLibrary.forEach(musicData => {
            addMusicToUI(musicData, musicList);
        });
    }

    function saveMusicFile(musicData) {
        const transaction = db.transaction(["songs"], "readwrite");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.add(musicData);
    
        request.onerror = (event) => {
            console.error("Error adding music file to IndexedDB:", event.target.error);
        };
    
        request.onsuccess = (event) => {
            console.log("Music file added to IndexedDB");
            musicData.id = event.target.result; // Store the generated ID
            musicLibrary.push(musicData);
            addMusicToUI(musicData, musicList);
            displayMusicLibrary(); // Refresh the entire music list
        };
    }

    function loadMusicFromDB() {
        console.log("Loading music from IndexedDB...");
        const transaction = db.transaction(["songs"], "readonly");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.getAll();
    
        request.onerror = (event) => {
            console.error("Error loading music from IndexedDB:", event.target.error);
        };
    
        request.onsuccess = (event) => {
            musicLibrary = event.target.result;
            console.log("Music library loaded from IndexedDB:", musicLibrary);
            displayMusicLibrary();
        };
    }
    
    function displayMusicLibrary() {
        console.log("Displaying music library...");
        musicList.innerHTML = ''; // Clear existing list
        musicLibrary.forEach(musicData => {
            addMusicToUI(musicData, musicList);
        });
        console.log("Music library display complete.");
    }

    function addMusicToUI(musicData, container) {
        if (!container) {
            console.error('Container not found for adding music item');
            return;
        }
        const musicItem = document.createElement('div');
        musicItem.className = 'music-item';
        musicItem.innerHTML = `
            <div class="music-item-image" style="background-image: url('${musicData.albumArt}')"></div>
            <div class="music-item-info">
                <h3>${musicData.name}</h3>
                <span class="duration">${musicData.duration}</span>
            </div>
        `;
        container.appendChild(musicItem);

        musicItem.addEventListener('click', () => playMusic(musicData, musicItem));
        musicItem.addEventListener('contextmenu', (e) => showContextMenu(e, musicData, musicItem));
    }

    function playMusic(musicData, musicItem) {
        resetAudioContext();

        currentAudio = new Audio(musicData.data);
        currentMusicItem = musicItem;
        currentAudio.play();
        musicItem.classList.add('playing');

        updatePlayer(musicData);
        playerContainer.classList.add('active');

        currentAudio.addEventListener('timeupdate', updateProgress);
        currentAudio.addEventListener('ended', playNextSong);

        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

        // Update play queue with a new random order
        playQueue = shuffleArray([...musicLibrary]);
    }

    function updatePlayer(musicData) {
        document.querySelector('.player-track-name').textContent = musicData.name;
        document.querySelector('.player-album-art').src = musicData.albumArt;
        totalTime.textContent = musicData.duration;
    }

    function updateProgress() {
        const percent = (currentAudio.currentTime / currentAudio.duration) * 100;
        progress.style.width = `${percent}%`;
        currentTime.textContent = formatDuration(currentAudio.currentTime);
    }

    function togglePlayPause() {
        if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                currentAudio.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    }

    function seek(e) {
        if (currentAudio) {
            const percent = e.offsetX / progressBar.offsetWidth;
            currentAudio.currentTime = percent * currentAudio.duration;
            updateProgress();
        }
    }

    function showContextMenu(e, musicData, musicItem) {
        e.preventDefault();
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;

        document.getElementById('rename-song').onclick = () => renameSong(musicData, musicItem);
        document.getElementById('delete-song').onclick = () => deleteSong(musicData, musicItem);
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
    }

    function renameSong(musicData, musicItem) {
        const newName = prompt('Enter new name for the song:', musicData.name);
        if (newName && newName !== musicData.name) {
            musicData.name = newName;
            updateMusicItem(musicData, musicItem);
            saveMusicLibrary();
        }
    }

    function deleteSong(musicData, musicItem) {
        const transaction = db.transaction(["songs"], "readwrite");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.delete(musicData.id);

        request.onsuccess = (event) => {
            console.log("Song deleted from IndexedDB");
            const index = musicLibrary.findIndex(item => item.id === musicData.id);
            if (index > -1) {
                musicLibrary.splice(index, 1);
                musicItem.remove();
            }
        };

        request.onerror = (event) => {
            console.error("Error deleting song from IndexedDB:", event.target.error);
        };
    }

    function updateMusicItem(musicData, musicItem) {
        musicItem.querySelector('h3').textContent = musicData.name;
        const transaction = db.transaction(["songs"], "readwrite");
        const objectStore = transaction.objectStore("songs");
        const request = objectStore.put(musicData);

        request.onsuccess = (event) => {
            console.log("Song updated in IndexedDB");
        };

        request.onerror = (event) => {
            console.error("Error updating song in IndexedDB:", event.target.error);
        };
    }

    function saveMusicLibrary() {
        localStorage.setItem('localityMusic', JSON.stringify(musicLibrary));
    }

    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        searchResults.innerHTML = '';
        const filteredMusic = musicLibrary.filter(music => 
            music.name.toLowerCase().includes(searchTerm)
        );
        filteredMusic.forEach(musicData => addMusicToUI(musicData, searchResults));
    }

    function handleNavigation(event) {
        event.preventDefault();
        const viewId = event.target.getAttribute('data-view');
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewId}-view`).classList.add('active');
        allNavItems.forEach(item => item.classList.remove('active'));
        event.target.classList.add('active');
    }

    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;    
    }

    function playPreviousSong() {
        if (playQueue.length > 1) {
            const currentIndex = playQueue.findIndex(item => item.id === currentMusicItem.id);
            const previousIndex = (currentIndex - 1 + playQueue.length) % playQueue.length;
            const previousSong = playQueue[previousIndex];
            playMusic(previousSong, document.querySelector(`[data-id="${previousSong.id}"]`));
        }
    }

    function playNextSong() {
        if (playQueue.length > 1) {
            const currentIndex = playQueue.findIndex(item => item.id === currentMusicItem.id);
            const nextIndex = (currentIndex + 1) % playQueue.length;
            const nextSong = playQueue[nextIndex];
            playMusic(nextSong, document.querySelector(`[data-id="${nextSong.id}"]`));
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
});