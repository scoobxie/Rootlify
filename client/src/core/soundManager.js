const radioTracks = [
  '/assets/audio/radio1.mp3',
  '/assets/audio/radio2.mp3',
  '/assets/audio/radio3.mp3',
  '/assets/audio/radio4.mp3',
  '/assets/audio/radio5.mp3',
];

const sfx = {
  pop: new Audio('/assets/audio/pop.mp3'),
  reward: new Audio('/assets/audio/reward.mp3'),
  footstep: new Audio('/assets/audio/grass-footstep.mp3'),
  waterPlant: new Audio('/assets/audio/water-drip.mp3'),
  fertilizePlant: new Audio('/assets/audio/feed-plant.mp3'),
  healPlant: new Audio('/assets/audio/heal-up.mp3'),
  splash: new Audio('/assets/audio/splash.wav'),
  fishing: new Audio('/assets/audio/fishing.wav')
};

let currentRadio = null;
let trackIndex = 0;
let isMuted = false;

// Preload Helper: fetches files so there is no delay when playing
const loadAudio = (url) => {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', resolve, { once: true });
    setTimeout(resolve, 3000); // Fail-safe: don't block the game if a file fails
  });
};

export const preloadRoomSounds = () => {
  loadAudio('/assets/audio/click.mp3');
  loadAudio('/assets/audio/success.wav');
};

export const preloadParkSounds = () => {
  radioTracks.forEach(track => loadAudio(track));
  loadAudio('/assets/audio/footstep.wav');
  loadAudio('/assets/audio/splash.wav');
  loadAudio('/assets/audio/fishing.wav');
};

export const playSFX = (name) => {
  if (isMuted || !sfx[name]) return;
  sfx[name].currentTime = 0; 
  sfx[name].play().catch(() => {});
};

export const startParkRadio = () => {
  if (currentRadio || isMuted) return;
  
  currentRadio = new Audio(radioTracks[trackIndex]);
  currentRadio.volume = 0.1;
  
  currentRadio.onended = () => {
    trackIndex = (trackIndex + 1) % radioTracks.length;
    currentRadio.src = radioTracks[trackIndex];
    currentRadio.play();
  };
  
  currentRadio.play().catch(e => console.log("Audio blocked by browser policy. Interaction needed."));
};

export const stopParkRadio = () => {
  if (currentRadio) {
    currentRadio.pause();
    currentRadio = null;
  }
};

export const toggleMute = () => {
  isMuted = !isMuted;
  if (isMuted && currentRadio) currentRadio.pause();
  if (!isMuted && currentRadio) currentRadio.play();
  return isMuted;
};