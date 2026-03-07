import React, { useState, useEffect } from 'react';
import PaperDoll from './PaperDoll';
import './CharacterCreator.css';

// ==============================================
// 1. DEFINIREA OPȚIUNILOR
// ==============================================

// --- FETE (GIRL) ---
const GIRL_SKINS = [
  "/assets/character/skins/girl-skintone-medium.png", // Default
  "/assets/character/skins/girl-skintone-light.png",
  "/assets/character/skins/girl-skintone-deep.png"
];

const GIRL_HAIRSTYLES = [
  "/assets/character/hair/girl-hair-pink.png",
  "/assets/character/hair/girl-hair-brunette.png",
  "/assets/character/hair/girl-hair-ginger.png",
  "/assets/character/hair/girl-hair-blonde.png"
];

const GIRL_OUTFITS = [
  "/assets/character/outfits/girl-default-outfit.png",
  "/assets/character/outfits/girl-cozy-outfit.png",
  "/assets/character/outfits/girl-outfit-pumpkin.png",
  "/assets/character/outfits/girl-outfit-preppy.png",
  "/assets/character/outfits/girl-outfit-protagonist.png",
  "/assets/character/outfits/girl-outfit-cinderella.png",
   "/assets/character/outfits/girl-outfit-princess-pink.png",
    "/assets/character/outfits/girl-outfit-princess-purple.png",
];


// --- BĂIEȚI (BOY) ---
const BOY_SKINS = [
    "/assets/character/skins/boy-skintone-medium.png",
    "/assets/character/skins/boy-skintone-light.png",
    "/assets/character/skins/boy-skintone-deep.png"
];

const BOY_HAIRSTYLES = [
  "/assets/character/hair/boy-hair-blue.png",
  "/assets/character/hair/boy-hair-brown.png",
  "/assets/character/hair/boy-hair-ginger.png",
  "/assets/character/hair/boy-hair-blonde.png"
];

const BOY_OUTFITS = [
    "/assets/character/outfits/boy-default-outfit.png",
    "/assets/character/outfits/boy-basic-outfit.png",
    "/assets/character/outfits/boy-outfit-brown-jacket.png",
    "/assets/character/outfits/boy-outfit-black-jacket.png",
    "/assets/character/outfits/boy-outfit-shorts.png",
    "/assets/character/outfits/boy-outfit-vacay.png",
    "/assets/character/outfits/boy-outfit-prince.png",
    "/assets/character/outfits/boy-outfit-prince-cape.png"
];


// ⬇️ AICI ERA PROBLEMA: Am adăugat currentLook și onClose
const CharacterCreator = ({ gender, currentLook, onSave, onClose, coins }) => {
  
  const isBoy = gender === 'boy';
  const currentSkins = isBoy ? BOY_SKINS : GIRL_SKINS;
  const currentHairs = isBoy ? BOY_HAIRSTYLES : GIRL_HAIRSTYLES;
  const currentOutfits = isBoy ? BOY_OUTFITS : GIRL_OUTFITS;

  // 🛡️ Funcție care găsește la ce număr e haina ta actuală
  const findIndex = (list, itemUrl) => {
    if (!itemUrl || !list) return 0;
    const index = list.indexOf(itemUrl);
    return index === -1 ? 0 : index; 
  };

  // ✅ Inițializăm state-ul cu ce ai tu deja pe tine (currentLook)!
  const [skinIndex, setSkinIndex] = useState(() => findIndex(currentSkins, currentLook?.skin));
  const [hairIndex, setHairIndex] = useState(() => findIndex(currentHairs, currentLook?.hair));
  const [outfitIndex, setOutfitIndex] = useState(() => findIndex(currentOutfits, currentLook?.outfit));

  const next = (setter, currentIdx, listLen) => setter((currentIdx + 1) % listLen);
  const prev = (setter, currentIdx, listLen) => setter((currentIdx - 1 + listLen) % listLen);

  const handleSave = () => {
    onSave({
      skin: currentSkins[skinIndex],
      hair: currentHairs[hairIndex],
      outfit: currentOutfits[outfitIndex]
    });
  };

  return (
    <div className="creator-overlay">
      
       <div className="creator-coins-display">
            Coins: {coins || 0}
        </div>

      <div className="creator-window">
        {/* ❌ BUTONUL DE ÎNCHIDERE  */}
        <button className="close-creator-btn" onClick={onClose}>✕</button>

        <h2>Modify Your Look</h2>
        
        <div className="creator-content">
          <div className="preview-section">
            <div className="paperdoll-wrapper">
              <PaperDoll 
                skinSrc={currentSkins[skinIndex]}
                hairSrc={currentHairs[hairIndex]}
                outfitSrc={currentOutfits[outfitIndex]}
              />
            </div>
          </div>

          <div className="controls-section">
            
            {/* 1. SKIN TONE */}
            <div className="control-row">
              <span>Skin Tone</span>
              <div className="buttons-group">
                <button onClick={() => prev(setSkinIndex, skinIndex, currentSkins.length)}>◀</button>
                <span>{skinIndex + 1}/{currentSkins.length}</span>
                <button onClick={() => next(setSkinIndex, skinIndex, currentSkins.length)}>▶</button>
              </div>
            </div>

            {/* 2. HAIR */}
            <div className="control-row">
              <span>Hair Style</span>
              <div className="buttons-group">
                <button onClick={() => prev(setHairIndex, hairIndex, currentHairs.length)}>◀</button>
                <span>{hairIndex + 1}/{currentHairs.length}</span>
                <button onClick={() => next(setHairIndex, hairIndex, currentHairs.length)}>▶</button>
              </div>
            </div>

            {/* 3. OUTFIT */}
            <div className="control-row">
               <span>Outfit</span>
               <div className="buttons-group">
                  <button onClick={() => prev(setOutfitIndex, outfitIndex, currentOutfits.length)}>◀</button>
                  <span>{outfitIndex + 1}/{currentOutfits.length}</span>
                  <button onClick={() => next(setOutfitIndex, outfitIndex, currentOutfits.length)}>▶</button>
               </div>
            </div>

            {/* BUTONUL ROZ */}
            <button className="save-btn-cute" onClick={handleSave}>
              SAVE LOOK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreator;