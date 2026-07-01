// Konfigurasi
const SOUNDS = [
    { name: 'Hujan Petir', file: 'hujan_petir.mp3', icon: 'fas fa-cloud-showers-heavy' },
    { name: 'Burung', file: 'burung.mp3', icon: 'fas fa-feather-alt' },
    { name: 'Angin', file: 'angin.mp3', icon: 'fas fa-wind' },
    { name: 'Air Mengalir', file: 'air.mp3', icon: 'fas fa-water' },
    { name: 'Api Unggun', file: 'api.mp3', icon: 'fas fa-fire' },
    { name: 'Kereta Api', file: 'kereta.mp3', icon: 'fas fa-train' },
    { name: 'Jangkrik', file: 'jangkrik.mp3', icon: 'fas fa-bug' },
    { name: 'Lonceng', file: 'lonceng.mp3', icon: 'fas fa-bell' }
];

const TIMER_DURATIONS = [0, 15, 30, 60, 90]; // 0=OFF, 15, 30, 60, 90 menit
const VOLUME_STEP_MASTER = 0.1; // Langkah perubahan 10%

// State aplikasi
const state = {
    audioElements: {},
    isPoweredOn: false,
    isPlaying: false,
    countdownTimer: null,
    durationIndex: 0,
    masterVolume: 0.5,
    zoomScale: 1.0
};

// Elemen DOM
const elements = {
    device: document.querySelector('.device'),
    powerBtn: document.getElementById('power-btn'),
    volumeUpBtn: document.getElementById('volume-up-btn'),
    volumeDownBtn: document.getElementById('volume-down-btn'),
    durationCycleBtn: document.getElementById('duration-cycle-btn'),
    countdownDisplay: document.getElementById('countdown-display'),
    statusText: document.getElementById('status-text'),
    allSliders: document.querySelectorAll('.sound-slider'),
    lcdElement: document.querySelector('.lcd')
};

// --- FUNGSI UTAMA VOLUME DAN AUDIO ---

/**
 * Inisialisasi elemen audio dan event listeners
 */
function initSounds() {
    // Buat elemen Audio (hidden) dan petakan ke audioElements
    SOUNDS.forEach(sound => {
        const audio = new Audio(`./audio/${sound.file}`);
        audio.loop = true; 
        audio.volume = 0; 
        state.audioElements[sound.file] = audio;
    });

    // Tambahkan Event Listener ke semua slider statis
    elements.allSliders.forEach(slider => {
        slider.value = 0; // Volume awal 0
        slider.addEventListener('input', handleSliderChange);
    });

    // Inisialisasi tampilan timer
    updateTimerDisplay();
}

/**
 * Menghitung dan menerapkan volume akhir ke elemen audio
 */
function updateAudioVolume(soundFile, sliderPercent) {
    const volumeSlider = sliderPercent / 100;
    const finalVolume = volumeSlider * state.masterVolume; 
    state.audioElements[soundFile].volume = finalVolume;
}

/**
 * Menangani perubahan nilai slider volume (Volume Individual)
 */
function handleSliderChange(e) {
    const slider = e.target;
    const soundFile = slider.getAttribute('data-sound-file');
    const volumePercent = parseInt(slider.value);
    
    updateAudioVolume(soundFile, volumePercent);
    checkPlayingStatus();
}

/**
 * Memeriksa apakah ada audio yang dimainkan dan menyesuaikan status
 */
function checkPlayingStatus() {
    let activeSounds = 0;
    
    for (const file in state.audioElements) {
        if (state.audioElements[file].volume > 0.001) { 
            activeSounds++;
            if (state.audioElements[file].paused) {
                state.audioElements[file].play().catch(e => console.error("Error playing audio:", e));
            }
        } else {
            // Hanya pause jika power menyala. Jika power mati, pause akan ditangani oleh fadeOutAndStop.
            if (state.isPoweredOn) {
                state.audioElements[file].pause();
            }
        }
    }

    if (activeSounds > 0) {
        state.isPlaying = true;
        if (!elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = "PLAYING";
        }
    } else {
        state.isPlaying = false;
        if (!elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = state.isPoweredOn ? "READY" : "OFF";
        }
    }
}

// --- FUNGSI KONTROL PERANGKAT ---

/**
 * Mengaktifkan atau menonaktifkan semua kontrol
 */
function toggleControls(enable) {
    const allControls = [
        elements.volumeUpBtn, 
        elements.volumeDownBtn, 
        elements.durationCycleBtn, 
        ...elements.allSliders
    ];
    
    allControls.forEach(control => control.disabled = !enable);
}

/**
 * Memudarkan semua suara secara bertahap (fade-out) sebelum mematikan audio sepenuhnya
 */
function fadeOutAndStop() {
    const fadeDuration = 800; // ms
    const fadeInterval = 50; // ms
    const steps = fadeDuration / fadeInterval;
    
    // Simpan volume awal masing-masing audio
    const initialVolumes = {};
    for (const file in state.audioElements) {
        initialVolumes[file] = state.audioElements[file].volume;
    }
    
    let currentStep = 0;
    const intervalId = setInterval(() => {
        currentStep++;
        const ratio = 1 - (currentStep / steps);
        
        for (const file in state.audioElements) {
            if (initialVolumes[file] > 0) {
                state.audioElements[file].volume = Math.max(0, initialVolumes[file] * ratio);
            }
        }
        
        if (currentStep >= steps) {
            clearInterval(intervalId);
            // Matikan/pause semua audio dan set volume ke 0
            for (const file in state.audioElements) {
                state.audioElements[file].pause();
                state.audioElements[file].volume = 0;
            }
            // Reset semua volume slider ke 0 di UI
            elements.allSliders.forEach(slider => {
                slider.value = 0;
            });
            checkPlayingStatus();
        }
    }, fadeInterval);
}

/**
 * Tombol ON/OFF
 */
elements.powerBtn.addEventListener('click', () => {
    state.isPoweredOn = !state.isPoweredOn;
    
    if (state.isPoweredOn) {
        // ON
        elements.powerBtn.classList.add('on');
        elements.lcdElement.classList.add('active');
        elements.device.classList.add('active');
        elements.statusText.textContent = `VOL: ${Math.round(state.masterVolume * 100)}%`; 
        updateTimerDisplay();
        toggleControls(true);
    } else {
        // OFF
        elements.powerBtn.classList.remove('on');
        elements.lcdElement.classList.remove('active');
        elements.device.classList.remove('active');
        
        // Matikan timer dan ubah UI langsung
        state.isPlaying = false;
        clearCountdown();
        elements.statusText.textContent = "OFF";
        elements.countdownDisplay.textContent = "00:00";
        toggleControls(false);

        // Mulai memudarkan suara
        fadeOutAndStop();
    }
});

// --- KONTROL VOLUME MASTER ---

/**
 * Mengatur semua volume audio berdasarkan perubahan masterVolume baru
 */
function setMasterVolume() {
    elements.allSliders.forEach(slider => {
        const soundFile = slider.getAttribute('data-sound-file');
        const sliderPercent = parseInt(slider.value);
        updateAudioVolume(soundFile, sliderPercent);
    });

    elements.statusText.textContent = `VOL: ${Math.round(state.masterVolume * 100)}%`; 
    checkPlayingStatus(); 
    
    setTimeout(() => {
        if (state.isPoweredOn && elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = state.isPlaying ? "PLAYING" : "READY";
        }
    }, 1500);
}

function adjustMasterVolume(delta) {
    if (!state.isPoweredOn) return;

    state.masterVolume += delta;
    state.masterVolume = Math.max(0, Math.min(1, state.masterVolume));
    setMasterVolume();
}

elements.volumeUpBtn.addEventListener('click', () => {
    adjustMasterVolume(VOLUME_STEP_MASTER);
});

elements.volumeDownBtn.addEventListener('click', () => {
    adjustMasterVolume(-VOLUME_STEP_MASTER);
});

// --- COUNTDOWN/TIMER ---

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const currentDuration = TIMER_DURATIONS[state.durationIndex];
    elements.countdownDisplay.textContent = formatTime(currentDuration * 60);
    elements.statusText.textContent = currentDuration === 0 ? "TIMER OFF" : `${currentDuration} MIN`;
    
    if (state.isPoweredOn && !state.isPlaying) {
        setTimeout(() => {
            if (elements.statusText.textContent.includes("MIN") || elements.statusText.textContent.includes("TIMER")) {
                 elements.statusText.textContent = "READY";
            }
        }, 1500);
    }
}

function clearCountdown() {
    clearInterval(state.countdownTimer);
    updateTimerDisplay();
}

function startCountdown(minutes) {
    clearInterval(state.countdownTimer);
    let totalSeconds = minutes * 60;
    
    elements.countdownDisplay.textContent = formatTime(totalSeconds);
    
    state.countdownTimer = setInterval(() => {
        totalSeconds--;
        elements.countdownDisplay.textContent = formatTime(totalSeconds);
        
        if (totalSeconds <= 0) {
            clearInterval(state.countdownTimer);
            elements.powerBtn.click();
        }
    }, 1000);
}

elements.durationCycleBtn.addEventListener('click', () => {
    if (!state.isPoweredOn) return;
    
    state.durationIndex = (state.durationIndex + 1) % TIMER_DURATIONS.length;
    clearInterval(state.countdownTimer);
    updateTimerDisplay();
    
    const currentDuration = TIMER_DURATIONS[state.durationIndex];
    if (currentDuration > 0 && state.isPlaying) {
        startCountdown(currentDuration);
    }
});

// --- KONTROL ZOOM (MOBILE PORTRAIT) ---

function getInitialScale() {
    if (window.innerWidth <= 640 && window.innerHeight > window.innerWidth) {
        if (window.innerHeight <= 520) return 0.70;
        if (window.innerHeight <= 640) return 0.80;
        return 0.90; // Default skala awal portrait mobile untuk breathing room
    }
    return 1.0;
}

function applyZoom() {
    const device = document.querySelector('.device');
    if (device) {
        if (window.innerWidth <= 640 && window.innerHeight > window.innerWidth) {
            device.style.transform = `rotate(90deg) scale(${state.zoomScale})`;
        } else {
            device.style.transform = '';
        }
    }
}

function initZoom() {
    state.zoomScale = getInitialScale();
    applyZoom();
}

/**
 * Mengatasi masalah event touch drag slider pada browser Firefox Mobile dan Chrome
 * yang berada di dalam kontainer yang di-rotate.
 */
function initSliderTouchHelper() {
    elements.allSliders.forEach(slider => {
        let isDragging = false;

        function updateValue(clientX, clientY) {
            const rect = slider.getBoundingClientRect();
            // Tentukan apakah slider secara visual horizontal atau vertikal di layar
            const isVisualHorizontal = rect.width > rect.height;
            let percent;
            
            if (isVisualHorizontal) {
                // Mode Horizontal (e.g. mobile portrait setelah dirotasi 90deg)
                const x = clientX - rect.left;
                percent = (x / rect.width) * 100;
            } else {
                // Mode Vertikal (e.g. desktop)
                const y = rect.bottom - clientY;
                percent = (y / rect.height) * 100;
            }
            
            percent = Math.max(0, Math.min(100, Math.round(percent)));
            slider.value = percent;
            
            // Picu input event agar volume audio terupdate
            const event = new Event('input', { bubbles: true });
            slider.dispatchEvent(event);
        }

        // Mouse Events
        slider.addEventListener('mousedown', (e) => {
            if (slider.disabled) return;
            isDragging = true;
            updateValue(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            updateValue(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Touch Events (Mobile)
        slider.addEventListener('touchstart', (e) => {
            if (slider.disabled) return;
            isDragging = true;
            const touch = e.touches[0];
            updateValue(touch.clientX, touch.clientY);
        }, { passive: true });

        slider.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            updateValue(touch.clientX, touch.clientY);
        }, { passive: true });

        slider.addEventListener('touchend', () => {
            isDragging = false;
        });
    });
}

// --- INISIALISASI APLIKASI ---
function initApp() {
    initSounds();
    toggleControls(false);
    initZoom();
    initSliderTouchHelper();
    
    // Inisialisasi visualizer latar belakang ambient
    ambientVisualizer.init();
    
    // Bind zoom button actions and resize handler
    window.addEventListener('resize', initZoom);

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn && zoomOutBtn) {
        zoomInBtn.addEventListener('click', () => {
            state.zoomScale = Math.min(1.5, state.zoomScale + 0.05);
            applyZoom();
        });
        zoomOutBtn.addEventListener('click', () => {
            state.zoomScale = Math.max(0.4, state.zoomScale - 0.05);
            applyZoom();
        });
    }
}

// --- SYSTEM VISUALIZER LATAR BELAKANG DENGAN KANVAS ---
const ambientVisualizer = {
    canvas: null,
    ctx: null,
    animationId: null,
    particles: [],
    lastTime: 0,
    lightningTimer: 0,
    lightningFlashOpacity: 0,

    init() {
        this.canvas = document.getElementById('ambient-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        // Atur ukuran kanvas pertama kali
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Jalankan loop render visualizer
        this.start();
    },

    resize() {
        if (!this.canvas) return;
        
        // Cek jika layar ponsel portrait sedang aktif (di mana CSS memutar orientasi sebesar 90 derajat)
        const isPortraitMobile = window.innerWidth <= 640 && window.innerHeight > window.innerWidth;
        
        if (isPortraitMobile) {
            // Tukar lebar dan tinggi agar koordinat kanvas internal cocok dengan rotasi 90deg CSS
            this.canvas.width = window.innerHeight;
            this.canvas.height = window.innerWidth;
        } else {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    },

    start() {
        if (this.animationId) return;
        this.lastTime = performance.now();
        const loop = (time) => {
            const dt = (time - this.lastTime) / 1000;
            this.lastTime = time;
            this.update(dt);
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    },

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    update(dt) {
        // 1. Dapatkan level volume masing-masing suara
        const volumes = {};
        let dominantSound = null;
        let maxVolume = -1;

        SOUNDS.forEach(sound => {
            const vol = state.isPoweredOn && state.audioElements[sound.file] 
                ? state.audioElements[sound.file].volume 
                : 0;
            volumes[sound.file] = vol;
            if (vol > 0.01) {
                if (vol > maxVolume) {
                    maxVolume = vol;
                    dominantSound = sound.file;
                }
            }
        });

        // 2. Transisi warna gradasi dasar berdasarkan suara dominan
        this.updateTheme(dominantSound, state.isPoweredOn);

        // 3. Buat partikel baru sesuai volume suara yang menyala
        this.generateParticles(volumes, dt);

        // 4. Update gerakan partikel
        this.particles = this.particles.filter(p => {
            p.update(dt, this.canvas.width, this.canvas.height);
            return p.life > 0;
        });

        // 5. Penanganan efek kilatan petir (Hujan Petir)
        const rainVol = volumes['hujan_petir.mp3'] || 0;
        if (rainVol > 0.05) {
            this.lightningTimer -= dt;
            if (this.lightningTimer <= 0) {
                this.lightningFlashOpacity = 0.25 + Math.random() * 0.45;
                this.lightningTimer = 6 + Math.random() * 12; // kilatan setiap 6-18 detik
            }
        } else {
            this.lightningFlashOpacity = 0;
        }

        if (this.lightningFlashOpacity > 0) {
            this.lightningFlashOpacity -= dt * 3.5; // kilatan meredup cepat
            if (this.lightningFlashOpacity < 0) this.lightningFlashOpacity = 0;
        }
    },

    updateTheme(dominantFile, isPoweredOn) {
        if (this.activeBackdrop === undefined) this.activeBackdrop = 1;
        if (this.currentGradient === undefined) this.currentGradient = '';

        let bgGradient = 'linear-gradient(135deg, #090a16 0%, #03040b 100%)'; // default power-off

        if (isPoweredOn) {
            if (!dominantFile) {
                // Menyala tapi idle (tidak ada suara)
                bgGradient = 'linear-gradient(135deg, #0e1026 0%, #060714 100%)';
            } else {
                switch (dominantFile) {
                    case 'hujan_petir.mp3':
                        bgGradient = 'linear-gradient(135deg, #121422 0%, #05060b 100%)';
                        break;
                    case 'burung.mp3':
                        bgGradient = 'linear-gradient(135deg, #081d13 0%, #020705 100%)';
                        break;
                    case 'angin.mp3':
                        bgGradient = 'linear-gradient(135deg, #0f1c2a 0%, #04080e 100%)';
                        break;
                    case 'air.mp3':
                        bgGradient = 'linear-gradient(135deg, #071c2a 0%, #02080d 100%)';
                        break;
                    case 'api.mp3':
                        bgGradient = 'linear-gradient(135deg, #260d05 0%, #080201 100%)';
                        break;
                    case 'kereta.mp3':
                        bgGradient = 'linear-gradient(135deg, #0f141a 0%, #040507 100%)';
                        break;
                    case 'jangkrik.mp3':
                        bgGradient = 'linear-gradient(135deg, #060914 0%, #020306 100%)';
                        break;
                    case 'lonceng.mp3':
                        bgGradient = 'linear-gradient(135deg, #140b20 0%, #040207 100%)';
                        break;
                }
            }
        }

        // Jika gradasi yang baru sama dengan yang lama, lewati transisi
        if (this.currentGradient === bgGradient) return;
        this.currentGradient = bgGradient;

        const bd1 = document.getElementById('ambient-backdrop-1');
        const bd2 = document.getElementById('ambient-backdrop-2');
        if (!bd1 || !bd2) return;

        if (this.activeBackdrop === 1) {
            // bd1 aktif (opacity 1), bd2 mati (opacity 0)
            // Terapkan gradien baru di bd2, buat bd2 fade-in (1) dan bd1 fade-out (0)
            bd2.style.background = bgGradient;
            bd2.style.opacity = '1';
            bd1.style.opacity = '0';
            this.activeBackdrop = 2;
        } else {
            // bd2 aktif (opacity 1), bd1 mati (opacity 0)
            // Terapkan gradien baru di bd1, buat bd1 fade-in (1) dan bd2 fade-out (0)
            bd1.style.background = bgGradient;
            bd1.style.opacity = '1';
            bd2.style.opacity = '0';
            this.activeBackdrop = 1;
        }
    },

    getGenerationCount(rate, dt) {
        const val = rate * dt;
        const floor = Math.floor(val);
        const remainder = val - floor;
        return floor + (Math.random() < remainder ? 1 : 0);
    },

    generateParticles(volumes, dt) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Hujan (Hujan Petir)
        const rainVol = volumes['hujan_petir.mp3'] || 0;
        if (rainVol > 0.02) {
            const count = this.getGenerationCount(rainVol * 180, dt);
            for (let i = 0; i < count; i++) {
                this.particles.push(new RainParticle(w, h));
            }
        }

        // 2. Bara Api (Api Unggun)
        const fireVol = volumes['api.mp3'] || 0;
        if (fireVol > 0.02) {
            const count = this.getGenerationCount(fireVol * 50, dt);
            for (let i = 0; i < count; i++) {
                this.particles.push(new EmberParticle(w, h));
            }
        }

        // 3. Kunang-kunang (Jangkrik)
        const cricketVol = volumes['jangkrik.mp3'] || 0;
        if (cricketVol > 0.02) {
            const count = this.getGenerationCount(cricketVol * 12, dt);
            const fireflyCount = this.particles.filter(p => p.type === 'firefly').length;
            if (fireflyCount < cricketVol * 40) {
                for (let i = 0; i < count; i++) {
                    this.particles.push(new FireflyParticle(w, h));
                }
            }
        }

        // 4. Daun Gugur (Burung)
        const birdVol = volumes['burung.mp3'] || 0;
        if (birdVol > 0.02) {
            const count = this.getGenerationCount(birdVol * 10, dt);
            const leafCount = this.particles.filter(p => p.type === 'leaf').length;
            if (leafCount < birdVol * 25) {
                for (let i = 0; i < count; i++) {
                    this.particles.push(new LeafParticle(w, h));
                }
            }
        }

        // 5. Arus Angin (Angin)
        const windVol = volumes['angin.mp3'] || 0;
        if (windVol > 0.02) {
            const count = this.getGenerationCount(windVol * 6, dt);
            const windCount = this.particles.filter(p => p.type === 'wind').length;
            if (windCount < windVol * 12) {
                for (let i = 0; i < count; i++) {
                    this.particles.push(new WindLine(w, h));
                }
            }
        }

        // 6. Riak Air (Air Mengalir)
        const waterVol = volumes['air.mp3'] || 0;
        if (waterVol > 0.02) {
            const count = this.getGenerationCount(waterVol * 4, dt);
            const waterCount = this.particles.filter(p => p.type === 'water').length;
            if (waterCount < waterVol * 10) {
                for (let i = 0; i < count; i++) {
                    this.particles.push(new WaterRipple(w, h));
                }
            }
        }

        // 7. Lampu Kereta (Kereta Api - Ilustrasi Gerbong Kereta Lewat)
        const trainVol = volumes['kereta.mp3'] || 0;
        if (this.trainSpawnTimer === undefined) this.trainSpawnTimer = 0;

        if (trainVol > 0.02) {
            this.trainSpawnTimer -= dt;
            if (this.trainSpawnTimer <= 0) {
                this.particles.push(new TrainCarriage(w, h, trainVol));
                // Lebar gerbong 240px + konektor 30px = 270px.
                // Pada kecepatan 320px/s, butuh jeda 270 / 320 = 0.843 detik agar saling menyambung.
                this.trainSpawnTimer = 0.843;
            }
        } else {
            this.trainSpawnTimer = 0;
        }

        // 8. Gelombang Lonceng (Lonceng)
        const chimeVol = volumes['lonceng.mp3'] || 0;
        if (chimeVol > 0.02) {
            const count = this.getGenerationCount(chimeVol * 4, dt);
            const chimeCount = this.particles.filter(p => p.type === 'chime').length;
            if (chimeCount < chimeVol * 8) {
                for (let i = 0; i < count; i++) {
                    this.particles.push(new SoundRing(w, h));
                }
            }
        }
    },

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // 1. Gambar Bintang berkelip jika Jangkrik diputar (atau default remang-remang saat On)
        const cricketVol = state.isPoweredOn && state.audioElements['jangkrik.mp3'] ? state.audioElements['jangkrik.mp3'].volume : 0;
        const defaultStars = state.isPoweredOn ? 0.35 : 0.12;
        const starIntensity = Math.max(defaultStars, cricketVol);
        if (starIntensity > 0.05) {
            this.drawStars(starIntensity);
        }

        // 2. Gambar semua partikel di atas kanvas
        this.particles.forEach(p => p.draw(this.ctx));

        // 3. Efek kilat petir
        if (this.lightningFlashOpacity > 0) {
            this.ctx.fillStyle = `rgba(225, 238, 255, ${this.lightningFlashOpacity})`;
            this.ctx.fillRect(0, 0, w, h);
        }
    },

    drawStars(intensity) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const numStars = Math.round(intensity * 110);
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < numStars; i++) {
            const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
            const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
            const size = (Math.sin(i * 4.12) * 1.5 + 2) % 2.2 + 0.6;
            
            const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(performance.now() / 420 + i));
            
            this.ctx.globalAlpha = twinkle * intensity;
            this.ctx.fillRect(x * w, y * h, size, size);
        }
        this.ctx.globalAlpha = 1.0;
    }
};

// --- KELAS DAN LOGIKA GERAKAN PARTIKEL ---

// 1. Rintik Hujan (Hujan Petir)
class RainParticle {
    constructor(w, h) {
        this.type = 'rain';
        this.x = Math.random() * w;
        this.y = -20;
        this.length = 18 + Math.random() * 22;
        this.speed = 450 + Math.random() * 250;
        this.angle = 76 + Math.random() * 8; // kemiringan sudut jatuh
        this.life = 1;
        this.opacity = 0.12 + Math.random() * 0.24;
    }
    update(dt, w, h) {
        const rad = (this.angle * Math.PI) / 180;
        this.x += Math.cos(rad) * this.speed * dt;
        this.y += Math.sin(rad) * this.speed * dt;
        if (this.y > h || this.x < -20 || this.x > w + 20) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.strokeStyle = `rgba(180, 210, 240, ${this.opacity})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        const rad = (this.angle * Math.PI) / 180;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(rad) * this.length, this.y - Math.sin(rad) * this.length);
        ctx.stroke();
    }
}

// 2. Bara Api (Api Unggun)
class EmberParticle {
    constructor(w, h) {
        this.type = 'ember';
        this.x = Math.random() * w;
        this.y = h + 15;
        this.size = 2 + Math.random() * 3.5;
        this.speedY = 70 + Math.random() * 95;
        this.speedX = (Math.random() - 0.5) * 45;
        this.life = 1;
        this.maxLife = 3.5 + Math.random() * 4.5;
        this.currentLife = this.maxLife;
        this.opacity = 0.55 + Math.random() * 0.45;
        this.colorVal = Math.random();
    }
    update(dt, w, h) {
        this.currentLife -= dt;
        this.life = this.currentLife / this.maxLife;
        this.y -= this.speedY * dt;
        this.x += (this.speedX + Math.sin(this.currentLife * 2.2) * 18) * dt;
        if (this.y < -15 || this.x < -15 || this.x > w + 15) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = this.size * 2.2;
        ctx.shadowColor = '#ff6200';
        
        let color = 'rgba(255, 90, 0, ';
        if (this.colorVal > 0.72) {
            color = 'rgba(255, 195, 40, '; // bara terang kuning
        } else if (this.colorVal < 0.18) {
            color = 'rgba(255, 15, 0, '; // bara merah membara
        }
        
        ctx.fillStyle = color + (this.opacity * this.life) + ')';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 3. Kunang-kunang (Jangkrik)
class FireflyParticle {
    constructor(w, h) {
        this.type = 'firefly';
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = 2 + Math.random() * 2.5;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 12 + Math.random() * 22;
        this.life = 1;
        this.maxLife = 6 + Math.random() * 8;
        this.currentLife = this.maxLife;
        this.opacity = 0;
        this.pulseSeed = Math.random() * 80;
    }
    update(dt, w, h) {
        this.currentLife -= dt;
        this.life = this.currentLife / this.maxLife;
        
        this.angle += (Math.random() - 0.5) * dt * 2.2;
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        
        if (this.x < -12) this.x = w + 12;
        if (this.x > w + 12) this.x = -12;
        if (this.y < -12) this.y = h + 12;
        if (this.y > h + 12) this.y = -12;
        
        const pulse = 0.45 + 0.55 * Math.sin(performance.now() / 650 + this.pulseSeed);
        this.opacity = Math.min(1.0, (1 - this.life) * 3.5) * this.life * pulse;
    }
    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = this.size * 2.8;
        ctx.shadowColor = '#d2ff2d';
        ctx.fillStyle = `rgba(185, 255, 45, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 4. Daun Berguguran (Burung)
class LeafParticle {
    constructor(w, h) {
        this.type = 'leaf';
        this.x = Math.random() * w;
        this.y = -15;
        this.size = 5 + Math.random() * 7;
        this.speedY = 28 + Math.random() * 38;
        this.speedX = -12 + Math.random() * 24;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 1.8;
        this.life = 1;
        this.maxLife = 9 + Math.random() * 9;
        this.currentLife = this.maxLife;
        this.opacity = 0.25 + Math.random() * 0.35;
        this.colorHue = 75 + Math.random() * 65; // daun hijau ke kuning tua/kecokelatan
    }
    update(dt, w, h) {
        this.currentLife -= dt;
        this.life = this.currentLife / this.maxLife;
        this.y += this.speedY * dt;
        this.x += (this.speedX + Math.sin(this.currentLife) * 13) * dt;
        this.rotation += this.rotSpeed * dt;
        if (this.y > h + 15 || this.x < -15 || this.x > w + 15) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = `hsla(${this.colorHue}, 58%, 38%, ${this.opacity * Math.min(1.0, this.life * 2)})`;
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.quadraticCurveTo(this.size / 2, 0, 0, this.size / 2);
        ctx.quadraticCurveTo(-this.size / 2, 0, 0, -this.size / 2);
        ctx.fill();
        ctx.restore();
    }
}

// 5. Arus Angin (Angin)
class WindLine {
    constructor(w, h) {
        this.type = 'wind';
        this.x = -160;
        this.y = Math.random() * h;
        this.length = 90 + Math.random() * 140;
        this.speed = 90 + Math.random() * 140;
        this.life = 1;
        this.maxLife = (w + 320) / this.speed;
        this.currentLife = 0;
        this.opacity = 0.07 + Math.random() * 0.11;
        this.amplitude = 8 + Math.random() * 18;
        this.freq = 0.004 + Math.random() * 0.009;
    }
    update(dt, w, h) {
        this.currentLife += dt;
        this.life = 1 - (this.currentLife / this.maxLife);
        this.x += this.speed * dt;
        if (this.x > w + 60 || this.life <= 0) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.strokeStyle = `rgba(240, 248, 255, ${this.opacity * Math.sin(this.life * Math.PI)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        for (let i = 0; i < this.length; i += 12) {
            const px = this.x - i;
            const py = this.y + Math.sin(px * this.freq) * this.amplitude;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();
    }
}

// 6. Riak Air di Bawah (Air Mengalir)
class WaterRipple {
    constructor(w, h) {
        this.type = 'water';
        this.x = Math.random() * w;
        this.y = h - (Math.random() * h * 0.28);
        this.radius = 8;
        this.maxRadius = 75 + Math.random() * 95;
        this.speed = 35 + Math.random() * 40;
        this.life = 1;
        this.opacity = 0.12 + Math.random() * 0.18;
    }
    update(dt, w, h) {
        this.radius += this.speed * dt;
        this.life = 1 - (this.radius / this.maxRadius);
        if (this.life <= 0) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = `rgba(140, 215, 245, ${this.opacity * this.life})`;
        ctx.lineWidth = 0.9;
        ctx.translate(this.x, this.y);
        ctx.scale(2.6, 0.48);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// 7. Ilustrasi Gerbong Kereta (Kereta Api)
class TrainCarriage {
    constructor(w, h, vol) {
        this.type = 'train';
        this.x = w + 50;
        this.y = h * 0.78; // Diposisikan lebih ke bawah di latar belakang
        this.width = 240;  // Lebar satu gerbong
        this.height = 42;  // Tinggi gerbong
        this.speed = 320;  // Kecepatan gerak kereta (px/detik)
        this.life = 1;
        this.opacity = vol;
    }
    update(dt, w, h) {
        this.x -= this.speed * dt;
        this.y = h * 0.78;
        if (this.x < -300) { // Hilang saat keluar layar kiri
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.save();
        
        // 1. Gambar Bodi Gerbong (Siluet Gelap Transparan)
        ctx.fillStyle = `rgba(15, 18, 32, ${this.opacity * 0.55})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 0.1})`;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 6);
        ctx.fill();
        ctx.stroke();
        
        // Gambar Roda di bawah gerbong
        ctx.fillStyle = `rgba(10, 12, 22, ${this.opacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(this.x + 40, this.y + this.height + 4, 6, 0, Math.PI * 2);
        ctx.arc(this.x + 60, this.y + this.height + 4, 6, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 60, this.y + this.height + 4, 6, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 40, this.y + this.height + 4, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Gambar Batang Penyambung Gerbong (Coupler) di belakang
        ctx.strokeStyle = `rgba(15, 18, 32, ${this.opacity * 0.6})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width, this.y + this.height - 15);
        ctx.lineTo(this.x + this.width + 30, this.y + this.height - 15);
        ctx.stroke();

        // 2. Gambar 4 Jendela Bercahaya di dalam Gerbong
        const windowW = 34;
        const windowH = 20;
        const startX = this.x + 20;
        const spacing = 52;
        const windowY = this.y + 11;
        
        for (let i = 0; i < 4; i++) {
            const wx = startX + (i * spacing);
            
            // Pendaran Cahaya Jendela
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(255, 200, 50, 0.45)';
            ctx.fillStyle = `rgba(255, 215, 80, ${this.opacity * 0.8})`;
            
            ctx.beginPath();
            ctx.roundRect(wx, windowY, windowW, windowH, 4);
            ctx.fill();
            
            // Sekat kusen jendela agar terlihat seperti jendela kereta asli
            ctx.shadowBlur = 0; // Matikan blur bayangan untuk garis pembatas tajam
            ctx.strokeStyle = `rgba(10, 12, 22, ${this.opacity * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(wx + windowW / 2, windowY);
            ctx.lineTo(wx + windowW / 2, windowY + windowH);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// 8. Gelombang Lingkaran Suara (Lonceng)
class SoundRing {
    constructor(w, h) {
        this.type = 'chime';
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.radius = 4;
        this.maxRadius = 135 + Math.random() * 135;
        this.speed = 45 + Math.random() * 55;
        this.life = 1;
        this.opacity = 0.28 + Math.random() * 0.38;
    }
    update(dt, w, h) {
        this.radius += this.speed * dt;
        this.life = 1 - (this.radius / this.maxRadius);
        if (this.life <= 0) {
            this.life = 0;
        }
    }
    draw(ctx) {
        ctx.strokeStyle = `rgba(215, 185, 220, ${this.opacity * this.life})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Jalankan aplikasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', initApp);