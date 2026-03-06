import React, { useState, useEffect, useRef } from 'react'; 
import PaperDoll from './PaperDoll';
import './Park.css';
import { playSFX, startParkRadio, stopParkRadio } from '../core/soundManager';

const Park = ({ players, socket, myId, onMove, user }) => { 
    const [stepPhase, setStepPhase] = useState(0);
    const [isSwimming, setIsSwimming] = useState(false);
    const [splashAnim, setSplashAnim] = useState(false);
    
    // Tracks exactly when other players step into the water
    const [remoteSwimmers, setRemoteSwimmers] = useState({});
    
    const collisionCanvasRef = useRef(null);
    const waterCanvasRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepPhase(prev => (prev === 0 ? 1 : 0));
        }, 200); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        startParkRadio();
        return () => stopParkRadio(); 
    }, []);

    useEffect(() => {
        if (players[myId]?.isMoving && stepPhase === 0) {
            playSFX('footstep'); 
        }
    }, [stepPhase, players[myId]?.isMoving]);

    // Loads the hidden hitboxes for walking and swimming
    useEffect(() => {
        const walkCanvas = collisionCanvasRef.current;
        const walkCtx = walkCanvas.getContext('2d', { willReadFrequently: true });
        const walkImg = new Image();
        walkImg.src = '/assets/garden/where u can walk.webp';
        
        const waterCanvas = waterCanvasRef.current;
        const waterCtx = waterCanvas.getContext('2d', { willReadFrequently: true });
        const waterImg = new Image();
        waterImg.src = '/assets/garden/water u can swim under.webp';

        const drawMasks = () => {
            walkCanvas.width = window.innerWidth;
            walkCanvas.height = window.innerHeight;
            if (walkImg.complete) walkCtx.drawImage(walkImg, 0, 0, walkCanvas.width, walkCanvas.height);

            waterCanvas.width = window.innerWidth;
            waterCanvas.height = window.innerHeight;
            if (waterImg.complete) waterCtx.drawImage(waterImg, 0, 0, waterCanvas.width, waterCanvas.height);
        };

        walkImg.onload = drawMasks;
        waterImg.onload = drawMasks;
        window.addEventListener('resize', drawMasks);
        return () => window.removeEventListener('resize', drawMasks);
    }, []);

    // Every time players move, we check their exact coordinates against the water canvas
useEffect(() => {
    if (!waterCanvasRef.current) return;
    const ctx = waterCanvasRef.current.getContext('2d', { willReadFrequently: true });
    
    const newSwimmers = {};
    Object.values(players).forEach(p => {
        if (p.id === myId) return;

        // 1. COORDINATE CHECK
        // If a player is in this box, they are in the air and should not be cut.
        const isInJumpZone = p.x > window.innerWidth * 0.20 && 
                           p.x < window.innerWidth * 0.32 && 
                           p.y > window.innerHeight * 0.50 && 
                           p.y < window.innerHeight * 0.66;

        if (isInJumpZone || p.isJumping) {
            newSwimmers[p.id] = false;
            return;
        }

        try {
            const alpha = ctx.getImageData(p.x, p.y, 1, 1).data[3];
            const isOnDock = p.x > window.innerWidth * 0.70 && p.x < window.innerWidth * 0.85 && p.y > window.innerHeight * 0.78;
            
            // Only swim if they aren't on the dock and aren't in the jump zone
            newSwimmers[p.id] = alpha > 200 && !isOnDock;
        } catch (err) {}
    });
    setRemoteSwimmers(newSwimmers);
}, [players, myId]);

    const handleMove = (e) => {
        if (e.target.closest('.hitbox') || e.target.closest('.no-click') || e.target.tagName === 'INPUT') return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.floor(e.clientX - rect.left);
        const y = Math.floor(e.clientY - rect.top);

        const basketX = window.innerWidth * 0.77; 
        const basketY = window.innerHeight * 0.57; 
        if (Math.hypot(x - basketX, y - basketY) < 60) return; 

        const walkCtx = collisionCanvasRef.current.getContext('2d');
        const walkAlpha = walkCtx.getImageData(x, y, 1, 1).data[3]; 

        const waterCtx = waterCanvasRef.current.getContext('2d');
        const waterAlpha = waterCtx.getImageData(x, y, 1, 1).data[3];

        if (walkAlpha === 0 && waterAlpha === 0) return; 

        const isOnDock = x > window.innerWidth * 0.70 && x < window.innerWidth * 0.85 && y > window.innerHeight * 0.78;
        const willSwim = waterAlpha > 200 && !isOnDock;

        const me = players[myId];
        if (me && !willSwim && !isSwimming) {
            const dx = x - me.x;
            const dy = y - me.y;
            const dist = Math.hypot(dx, dy);
            const steps = Math.floor(dist / 20); 
            
            let crossesWater = false;
            for (let i = 1; i <= steps; i++) {
                const sampleX = Math.floor(me.x + dx * (i / steps));
                const sampleY = Math.floor(me.y + dy * (i / steps));
                const alpha = waterCtx.getImageData(sampleX, sampleY, 1, 1).data[3];
                
                if (alpha > 200 && sampleX < window.innerWidth * 0.55) {
                    crossesWater = true;
                    break;
                }
            }

            if (crossesWater) {
                return; 
            }
        }

        setIsSwimming(willSwim);

        if (onMove) {
            onMove(x, y);
        } else {
            socket.emit('move', { id: socket.id, x, y });
        }

        if (willSwim) {
            if (!isSwimming) {
                setTimeout(() => setIsSwimming(true), 600);
            }
        } else {
            setIsSwimming(false);
        }
    };

    const handlePlayerClick = (e, targetPlayer) => {
        if (targetPlayer.id === myId) return; 

        const me = players[myId];
        if (!me) return;

        // Uses our new accurate remoteSwimmers check!
        const amISwimming = isSwimming;
        const isTargetSwimming = remoteSwimmers[targetPlayer.id];

        if (amISwimming && isTargetSwimming) {
            e.stopPropagation(); 
            socket.emit('chat_message', `*Splashes ${targetPlayer.username || "Gardener"}!*`);
            
            setSplashAnim(true);
            setTimeout(() => setSplashAnim(false), 1000);
        }
    };

    const handleEat = (e) => {
        e.stopPropagation();
        const me = players[myId];
        if (!me) return;

        const blanketX = window.innerWidth * 0.78;
        const blanketY = window.innerHeight * 0.62;
        if (Math.hypot(me.x - blanketX, me.y - blanketY) > 180) { 
            return;
        }

        socket.emit('chat_message', "*nom nom*");
    };

    const handleFish = (e) => {
        e.stopPropagation();
        const me = players[myId];
        if (!me) return;

        const dockX = window.innerWidth * 0.78;
        const dockY = window.innerHeight * 0.82;
        
        if (Math.hypot(me.x - dockX, me.y - dockY) > 150) { 
            return;
        }
        
        playSFX('fishing');
        socket.emit('chat_message', "*Casts a fishing line into the water...*");
        
        setTimeout(() => {
            const fortunes = [
                "I caught a Golden Koi! Good luck is coming my way!",
                "I found a rusted key. Some things stay closed until you're truly ready.",
                "I caught a Starfish! My wishes will soon come true!",
                "I caught a message in a bottle. The ink is smudged by tears, but the 'I’m sorry' is still perfectly clear.",
                "A grumpy toad told me to put him back!",
                "I caught a cloud-fish! It floated right out of the bucket!",
                "I pulled up an old copper coin. It’s worth nothing now, but it probably meant everything to someone once.",
                "I caught a scale that shines like a mirror. I saw a version of myself in it that was smiling.",
                "I pulled up a piece of driftwood shaped like a heart. Love is often found exactly where it was lost.",
                "A crab pinched my line! It didn't want the bait; it just wanted to show me who really owns this spot.",
                "I found a locket with no picture inside. It’s waiting for a memory worth keeping.",
                "I caught a message in a bottle. It says, 'If you're reading this, you're exactly where you need to be.",
                "I pulled up a small, rusted cage. The door was wide open, yet it felt like something was still trapped inside.",
                "I caught a hook that shines like the sun.",
                "I caught a van key! It’s time to stop overthinking and just see where the road takes me.",
            ];
            const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            socket.emit('chat_message', `*Reels in...* ${randomFortune}`);
        }, 3000); 
    };

const handleJumpPool = (e) => {
    e.stopPropagation();
    
    const boardTopX = window.innerWidth * 0.23;
    const boardTopY = window.innerHeight * 0.64; 
    
    setIsSwimming(false); 
    // Inform the socket you are jumping so others don't "cut" your sprite
    socket.emit('move', { id: socket.id, x: boardTopX, y: boardTopY, isJumping: true });

    setTimeout(() => {
        const peakX = window.innerWidth * 0.25;
        const peakY = window.innerHeight * 0.55; 
        socket.emit('move', { id: socket.id, x: peakX, y: peakY, isJumping: true });
        
        setTimeout(() => {
            const poolX = window.innerWidth * 0.33;
            const poolY = window.innerHeight * 0.68;
            
            setIsSwimming(true); 
            // Jump finished, land in water (isJumping: false)
            socket.emit('move', { id: socket.id, x: poolX, y: poolY, isJumping: false });
            playSFX('splash');
            socket.emit('chat_message', "*SPLASH*");
        }, 500); 
    }, 1000); 
};

    const handleStairsPool = (e) => {
        e.stopPropagation();
        
        if (isSwimming) {
            const grassX = window.innerWidth * 0.50;
            const grassY = window.innerHeight * 0.80;
            setIsSwimming(false); 
            socket.emit('move', { id: socket.id, x: grassX, y: grassY });

        } else {
            const wadeX = window.innerWidth * 0.40;
            const wadeY = window.innerHeight * 0.68;
            setIsSwimming(true);
            socket.emit('move', { id: socket.id, x: wadeX, y: wadeY });
        }
    };

    return (
        <div className="park-container" onClick={handleMove}>
            
            <canvas ref={collisionCanvasRef} style={{ display: 'none' }} />
            <canvas ref={waterCanvasRef} style={{ display: 'none' }} />

            <img src="/assets/garden/base background (can t walk on it).webp" alt="bg" className="map-layer bg-base" />
            <img src="/assets/garden/where u can walk.webp" alt="walkable" className="map-layer bg-walkable" />
            <img src="/assets/garden/water u can swim under.webp" alt="water" className="map-layer decor-water" />
            <img src="/assets/garden/get in and out the pool.webp" alt="stairs" className="map-layer decor-pool-stairs" />
            <img src="/assets/garden/jump into the pool.webp" alt="diving board" className="map-layer decor-pool-jump" />
            <img src="/assets/garden/the docks - go fishing.webp" alt="docks" className="map-layer decor-docks" />
            <img src="/assets/garden/picnic basket - eat.webp" alt="picnic" className="map-layer decor-picnic" />
            <img src="/assets/garden/tree for decor.webp" alt="tree" className="map-layer decor-tree" style={{ zIndex: 100 }} />
            <img src="/assets/garden/castle.webp" alt="castle" className="map-layer decor-castle" />

            <div className="hitbox" onClick={handleEat} style={{ top: '55%', left: '80%', width: '50px', height: '50px' }} title="Eat a snack!"></div>
            <div className="hitbox" onClick={handleFish} style={{ top: '82%', left: '78%', width: '50px', height: '50px' }} title="Go fishing!"></div>
            <div className="hitbox" onClick={handleJumpPool} style={{ top: '61%', left: '20%', width: '80px', height: '50px' }} title="Jump in!"></div>
            <div className="hitbox" onClick={handleStairsPool} style={{ top: '70%', left: '45%', width: '80px', height: '50px' }} title="Use stairs"></div>

            {Object.values(players).map((p) => {
                const getAnimSrc = (src) => {
                    if (!src) return null;
                    if (p.isMoving && stepPhase === 0) return src.replace('.png', '-walk.png');
                    return src; 
                };

                const isGirl = p.characterLook?.skin?.includes('girl');
                const facing = p.direction || (isGirl ? 'left' : 'right');
                let mirrorStyle = 'scaleX(1)'; 
                if ((isGirl && facing === 'right') || (!isGirl && facing === 'left')) {
                    mirrorStyle = 'scaleX(-1)';
                }

                const playerZIndex = 200 + Math.floor(p.y);
                
                // Rely on our local state for us and the accurate canvas check for others
                const currentlySwimming = p.id === myId ? isSwimming : remoteSwimmers[p.id];

                let swimDepth = 30; 
                if (currentlySwimming && p.x > window.innerWidth * 0.65) {
                    const lakeProgress = (p.x - window.innerWidth * 0.65) / (window.innerWidth * 0.35);
                    swimDepth = 30 + (lakeProgress * 15); 
                }

                const swimStyle = {
                    clipPath: currentlySwimming ? `inset(0 0 ${swimDepth}% 0)` : 'inset(0 0 0% 0)'
                };

                const plantSwimStyle = {
                    clipPath: currentlySwimming ? `inset(0 0 ${swimDepth / 2.2}% 0)` : 'inset(0 0 0% 0)'
                };

                return (
                    <div key={p.id} onClick={(e) => handlePlayerClick(e, p)} style={{
                            position: 'absolute', left: p.x, top: p.y,
                            transition: 'left 0.6s linear, top 0.6s linear', 
                            transform: 'translate(-50%, -100%)',
                            zIndex: playerZIndex, 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', 
                            pointerEvents: 'auto', cursor: currentlySwimming ? 'pointer' : 'default'
                        }}>

                        {/* Trailing Plants */}
                        {p.plantHeads && p.plantHeads.map((head, idx) => (
                            <img 
                                key={head.id || idx}
                                src={head.image || head.sprite || head.plantTypeData?.image || '/assets/mutations/sunflower.mutation.png'} 
                                alt="Follower Plant"
                                
                                // HOP WHEN THE PLAYER WALKS
                                className={p.isMoving ? 'plant-hopping' : ''} 
                                
                                style={{
                                    position: 'absolute',
                                    left: p.direction === 'left' ? `${50 + (idx * 25)}px` : `-${35 + (idx * 25)}px`,
                                    bottom: '10px',
                                    width: '75px',
                                    height: 'auto',
                                    imageRendering: 'pixelated',
                                    transition: 'left 0.5s ease',
                                    zIndex: -1,
                                    
                                    // 👇 NEW: CLIPS THEM UNDER THE WATER LIKE THE PLAYER
                                    ...plantSwimStyle
                                }}
                            />
                        ))}
                   
                        {p.chatMessage && (
                            <div style={{ position: 'absolute', bottom: '100%', marginBottom: '10px', background: '#fff0f5', border: '3px solid #ff80ab', padding: '5px 12px', borderRadius: '15px', fontFamily: 'VT323', fontSize: '1.2rem', whiteSpace: 'nowrap', zIndex: 100, color: '#880e4f' }}>
                                {p.chatMessage}
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #ff80ab' }}></div>
                            </div>
                        )}

                        <div style={{ background: p.id === myId ? '#ff80ab' : 'white', color: p.id === myId ? 'white' : '#5d4037', padding: '2px 12px', borderRadius: '10px', border: '3px solid #5d4037', fontFamily: 'VT323', fontSize: '1.2rem', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                            {p.username || "Gardener"}
                        </div>

                        {/* Splitting the transforms to prevent the mirror style from destroying the wiggle animation */}
                        <div style={{ width: '80px', height: '110px', transform: mirrorStyle, transition: 'transform 0.1s, clip-path 0.6s linear', ...swimStyle }}>
                            <div className={splashAnim && p.id === myId ? 'splash-wiggle' : ''} style={{ width: '100%', height: '100%' }}>
                                <PaperDoll 
                                    skinSrc={getAnimSrc(p.characterLook?.skin)} 
                                    hairSrc={getAnimSrc(p.characterLook?.hair)} 
                                    outfitSrc={getAnimSrc(p.characterLook?.outfit)} 
                                    isBreathing={!p.isMoving} 
                                />
                            </div>
                        </div>
                    </div>
                );
            })}

            <div className="chat-input-container">
                <input 
                    type="text" 
                    className="chat-input-field"
                    placeholder="Type to chat..." 
                    maxLength={40}
                    aria-label="Chat input" 
                    onClick={(e) => e.stopPropagation()} 
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                            socket.emit('chat_message', e.target.value);
                            e.target.value = ''; 
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default Park;