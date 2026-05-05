// words array is loaded from words.js

// DOM Elements
const screens = {
    start: document.getElementById('start-screen'),
    play: document.getElementById('play-screen'),
    pause: document.getElementById('pause-screen'),
    result: document.getElementById('result-screen')
};

const elements = {
    startBtn: document.getElementById('start-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    pauseRetryBtn: document.getElementById('pause-retry-btn'),
    menuBtn: document.getElementById('menu-btn'),
    retryBtn: document.getElementById('retry-btn'),
    
    livesDisplay: document.getElementById('lives-display'),
    currentScore: document.getElementById('current-score'),
    wordDisplay: document.getElementById('word-display'),
    readingDisplay: document.getElementById('reading-display'),
    romajiDisplay: document.querySelector('.romaji-display'),
    typedSpan: document.querySelector('.typed'),
    untypedSpan: document.querySelector('.untyped'),
    finalScore: document.getElementById('final-score'),
    timeBar: document.getElementById('time-bar'),
    player: document.getElementById('player'),
    coin: document.getElementById('coin'),
    obstacle: document.getElementById('obstacle'),
    hadou: document.getElementById('hadou'),
    explosion: document.getElementById('explosion')
};

// Game State
let isPlaying = false;
let isPaused = false;
let currentWordData = null;
let typedIndex = 0;
let score = 0;
let lives = 3;

// Timer State
const TIME_LIMIT = 10000; // 10秒
let wordStartTime = 0;
let pauseStartTime = 0;
let totalPausedTime = 0;
let animationFrameId = null;

// Demo State
let demoInterval = null;

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// ---------------- Audio Functions ----------------
function playCoinSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'square';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(988, now); // B5
    osc.frequency.setValueAtTime(1319, now + 0.1); // E6
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
}

function playMissSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
}

function playHitSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'square';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
}

function playHadouSound() {
    if (!audioCtx) return;
    // シュバッ！というノイズとピッチダウンを混ぜた音
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
}

// ---------------- Game Logic ----------------
function updateLivesDisplay() {
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '❤️';
    for (let i = lives; i < 3; i++) hearts += '🖤';
    elements.livesDisplay.textContent = hearts;
}

function padScore(num) {
    return num.toString().padStart(6, '0');
}

function showScreen(screenName) {
    if (screenName !== 'pause') {
        Object.values(screens).forEach(s => s.classList.remove('active'));
    }
    screens[screenName].classList.add('active');
}

function hideScreen(screenName) {
    screens[screenName].classList.remove('active');
}

function getNextWord() {
    const randomIndex = Math.floor(Math.random() * words.length);
    currentWordData = words[randomIndex];
    typedIndex = 0;
    
    elements.obstacle.style.opacity = '1';
    updateDisplay();
    startWordTimer();
}

function updateDisplay() {
    elements.wordDisplay.textContent = currentWordData.word;
    elements.readingDisplay.textContent = currentWordData.reading;
    
    const romaji = currentWordData.romaji;
    const typedText = romaji.substring(0, typedIndex);
    const untypedText = romaji.substring(typedIndex);
    
    elements.typedSpan.textContent = typedText;
    elements.untypedSpan.textContent = untypedText;
}

function startWordTimer() {
    wordStartTime = performance.now();
    totalPausedTime = 0;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    elements.obstacle.style.transition = 'none';
    elements.obstacle.style.transform = `translateX(0px)`;
    
    elements.player.classList.add('run');
    
    animationFrameId = requestAnimationFrame(updateTimer);
}

function updateTimer(timestamp) {
    if (!isPlaying || isPaused) return;
    
    const elapsed = timestamp - wordStartTime - totalPausedTime;
    const remaining = Math.max(0, TIME_LIMIT - elapsed);
    const progress = remaining / TIME_LIMIT;
    
    elements.timeBar.style.transform = `scaleX(${progress})`;
    
    // コンテナ幅800px。障害物は右端（+50px）、プレイヤーは左（80px）。
    // 衝突位置までの距離は約770pxとする。
    const moveX = -(1 - progress) * 770;
    elements.obstacle.style.transform = `translateX(${moveX}px)`;

    if (remaining <= 0) {
        handleHitObstacle();
    } else {
        animationFrameId = requestAnimationFrame(updateTimer);
    }
}

function handleHitObstacle() {
    playHitSound();
    lives--;
    updateLivesDisplay();
    
    elements.player.classList.remove('run');
    elements.player.classList.add('hit');
    setTimeout(() => {
        elements.player.classList.remove('hit');
    }, 1000);

    if (lives <= 0) {
        endGame();
    } else {
        getNextWord();
    }
}

function handleHadou() {
    elements.player.classList.remove('run');
    elements.player.classList.add('attack');
    playHadouSound();
    
    // 現在の障害物の位置（X）を計算
    const elapsed = performance.now() - wordStartTime - totalPausedTime;
    const remaining = Math.max(0, TIME_LIMIT - elapsed);
    const progress = remaining / TIME_LIMIT;
    const currentMoveX = -(1 - progress) * 770;
    
    // 波動の発射アニメーション
    elements.hadou.style.setProperty('--target-x', (600 + currentMoveX) + 'px');
    elements.hadou.classList.remove('fire');
    void elements.hadou.offsetWidth;
    elements.hadou.classList.add('fire');
    
    // 波動が当たるタイミング（約150ms後）で爆発
    setTimeout(() => {
        elements.obstacle.style.opacity = '0'; // 障害物消滅
        
        // 爆発エフェクトを障害物の位置に出す
        // obstacle は right:-50px からの translateX なので、画面左からの絶対位置は適当に計算
        // cssで bottom:100px 固定とし、leftを指定する
        const hitAbsoluteLeft = 800 - 50 + currentMoveX; 
        elements.explosion.style.left = (hitAbsoluteLeft - 5) + 'px';
        
        elements.explosion.classList.remove('boom');
        void elements.explosion.offsetWidth;
        elements.explosion.classList.add('boom');
        playHitSound(); // 爆発音として再利用
        
    }, 150);

    // 次の単語へ
    setTimeout(() => {
        elements.player.classList.remove('attack');
        if (isPlaying) getNextWord();
    }, 400);
}

function showCoinAnimation() {
    elements.coin.classList.remove('show');
    void elements.coin.offsetWidth;
    elements.coin.classList.add('show');
}

// ---------------- Demo Mode ----------------
function runDemoLoop() {
    if (isPlaying) return;
    
    elements.player.classList.add('run');
    elements.obstacle.style.opacity = '1';
    elements.obstacle.style.transition = 'transform 2s linear';
    elements.obstacle.style.transform = 'translateX(-500px)';
    
    setTimeout(() => {
        if (isPlaying) return;
        elements.player.classList.remove('run');
        elements.player.classList.add('attack');
        
        elements.hadou.style.setProperty('--target-x', '300px');
        elements.hadou.classList.add('fire');
        
        setTimeout(() => {
            if (isPlaying) return;
            elements.obstacle.style.opacity = '0';
            elements.explosion.style.left = '345px';
            elements.explosion.classList.add('boom');
            
            setTimeout(() => {
                elements.hadou.classList.remove('fire');
                elements.explosion.classList.remove('boom');
                elements.player.classList.remove('attack');
                elements.obstacle.style.transition = 'none';
                elements.obstacle.style.transform = 'translateX(0px)';
            }, 500);
            
        }, 150);
        
    }, 1000);
}

function startDemo() {
    if (demoInterval) clearInterval(demoInterval);
    runDemoLoop();
    demoInterval = setInterval(runDemoLoop, 3000);
}

function stopDemo() {
    if (demoInterval) clearInterval(demoInterval);
    elements.player.classList.remove('run', 'attack');
    elements.hadou.classList.remove('fire');
    elements.explosion.classList.remove('boom');
    elements.obstacle.style.transition = 'none';
    elements.obstacle.style.transform = 'translateX(0px)';
    elements.obstacle.style.opacity = '1';
}

// ---------------- Control Flow ----------------
function startGame() {
    stopDemo();
    initAudio();
    isPlaying = true;
    isPaused = false;
    score = 0;
    lives = 3;
    
    elements.currentScore.textContent = padScore(score);
    updateLivesDisplay();
    
    showScreen('play');
    getNextWord();
}

function togglePause() {
    if (!isPlaying || lives <= 0) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        pauseStartTime = performance.now();
        elements.player.classList.remove('run');
        showScreen('pause');
    } else {
        totalPausedTime += performance.now() - pauseStartTime;
        elements.player.classList.add('run');
        hideScreen('pause');
        animationFrameId = requestAnimationFrame(updateTimer);
    }
}

function returnToMenu() {
    isPlaying = false;
    isPaused = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    hideScreen('pause');
    showScreen('start');
    startDemo();
}

function endGame() {
    isPlaying = false;
    isPaused = false;
    elements.player.classList.remove('run');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    elements.finalScore.textContent = padScore(score);
    showScreen('result');
}

function handleKeydown(e) {
    if (e.key === 'Escape') {
        togglePause();
        return;
    }
    
    if (!isPlaying || isPaused) return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    
    const targetChar = currentWordData.romaji[typedIndex];
    const inputChar = e.key.toLowerCase();
    
    if (inputChar === targetChar) {
        playCoinSound();
        showCoinAnimation();
        typedIndex++;
        score += 10;
        elements.currentScore.textContent = padScore(score);
        
        if (typedIndex >= currentWordData.romaji.length) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            score += 100;
            elements.currentScore.textContent = padScore(score);
            handleHadou();
        } else {
            updateDisplay();
        }
    } else {
        wordStartTime -= 1000;
        playMissSound();
        elements.romajiDisplay.classList.remove('error-shake');
        void elements.romajiDisplay.offsetWidth;
        elements.romajiDisplay.classList.add('error-shake');
    }
}

// Event Listeners
elements.startBtn.addEventListener('click', startGame);
elements.retryBtn.addEventListener('click', startGame);
elements.resumeBtn.addEventListener('click', togglePause);
elements.pauseRetryBtn.addEventListener('click', () => { hideScreen('pause'); startGame(); });
elements.menuBtn.addEventListener('click', returnToMenu);

window.addEventListener('keydown', handleKeydown);

elements.romajiDisplay.addEventListener('animationend', () => {
    elements.romajiDisplay.classList.remove('error-shake');
});

// Initialize Demo on load
startDemo();
