const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Filter = require('bad-words');
const filter = new Filter();

dotenv.config();

const app = express();
app.use(express.json());


// ──── ୨୧ ──── MMO ──── ୨୧ ────

// SOCKET.IO (MMO MAGIC)
const server = http.createServer(app); // Creates HTTP server
const io = new Server(server, {
    cors: {
        origin: "*", // Allows connection from anywhere
        methods: ["GET", "POST"]
    }
});

// SERVER MEMORY (Keeps track of players)
let onlinePlayers = {}; 

io.on('connection', (socket) => {
    console.log(`✨ New player connected! ID: ${socket.id}`);

// 1. When entering the park (JOIN)
    socket.on('join-park', (data) => {
        
        // Delete any old player with the same name (removes ghosts)
        for (const [id, player] of Object.entries(onlinePlayers)) {
            if (player.username === data.username) {
                console.log(`👻 Removing ghost of ${player.username} (ID: ${id})`);
                delete onlinePlayers[id];
            }
        }

        // Save new player
        onlinePlayers[socket.id] = {
            id: socket.id,
            x: data.x || 400,
            y: data.y || 400,
            username: data.username || "Gardener",
            characterLook: data.characterLook || {},
            plantHeads: data.plantHeads || [],
            coins: data.coins || 0,
            isVeteran: data.isVeteran || false,
            isBanned: data.isBanned || false
        };
        
        console.log(`👋 ${data.username} joined the park.`);
        
        io.emit('update_players', onlinePlayers);
        
        // Global notification
        socket.broadcast.emit('global_notification', {
            text: `✿ ${data.username || 'A friend'} joined the garden! ✿`
        });
    });

    // When moving (MOVE)
    socket.on('move', (data) => {
        if (onlinePlayers[socket.id]) {
            // Update ONLY coordinates, but COPY old data
            onlinePlayers[socket.id] = {
                ...onlinePlayers[socket.id], 
                x: data.x,
                y: data.y
            };
            // Send updated list to everyone
            io.emit('update_players', onlinePlayers);
        }
    });

    // CHAT SYSTEM 
    socket.on('chat_message', (msg) => {
        if (onlinePlayers[socket.id]) {
            try {
                // CLEAN BAD WORDS
                const cleanMessage = filter.clean(msg);

                //save to memory
                onlinePlayers[socket.id].chatMessage = cleanMessage;
                
                // SEND CLEAN MSG
                io.emit('player_chat', {
                    id: socket.id,
                    text: cleanMessage
                });
            } catch (e) {
              //save to memory
              onlinePlayers[socket.id].chatMessage = msg;
                // OR THE ORIGINAL
                io.emit('player_chat', { id: socket.id, text: msg });
            }
              // clear memory after 5 seconds
              setTimeout(() => {
                  if (onlinePlayers[socket.id]) {
                      delete onlinePlayers[socket.id].chatMessage;
                  }
              }, 5000);
        }
    });

    // When leaving (DISCONNECT)
    socket.on('disconnect', () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        delete onlinePlayers[socket.id];
        io.emit('update_players', onlinePlayers);
    });
});

// ──── ୨୧ ──── SERVER  CONFIG ──── ୨୧ ────

app.use(cors());
app.get('/', (req, res) => {
  res.send('The server is up! 🌱');
});

// ──── ୨୧ ──── DATABASE SCHEMA ──── ୨୧ ────

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  character: { type: String, enum: ['girl', 'boy'], default: 'girl' },
  gameSave: { type: Object, default: null },
  coins: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false }, 
  isVeteran: { type: Boolean, default: false },
  characterLook: { type: Object, default: {} }
});

const User = mongoose.model('User', UserSchema);

// ──── ୨୧ ──── HELPER VARIABLES ──── ୨୧ ────

// Temporary memory for reset codes
const resetCodes = {}; 
// Memory for Cooldowns (Spam Protection)
const emailCooldowns = {}; 

// ──── ୨୧ ──── MIDDLEWARE ──── ୨୧ ────

const verifyToken = (req, res, next) => {
  const tokenHeader = req.headers['authorization'];
  
  if (!tokenHeader) return res.status(401).json({ message: "Access Denied: No Token" });

  try {
    const token = tokenHeader.split(' ')[1]; // Remove "Bearer "
    const verified = jwt.verify(token, process.env.JWT_SECRET || "secretKey");
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

// ──── ୨୧ ──── API ROUTES ──── ୨୧ ────

// ★ REGISTER ★
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, character } = req.body;
    
    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists!" });

    // Check if username exists
    const userWithName = await User.findOne({ username });
    if (userWithName) {
        return res.status(400).json({ message: "Username already taken!" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      character
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ★ LOGIN ★
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ message: "User not found!" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Wrong password!" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secretKey");
    
    res.status(200).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ★ SAVE GAME ★
app.post('/api/save', verifyToken, async (req, res) => {
  try {
    const { email, gameState, coins } = req.body;
    
    const updateData = { gameSave: gameState };
    if (coins !== undefined) {
        updateData.coins = coins;
    }
    
    await User.findOneAndUpdate({ email }, updateData);
    res.status(200).json({ message: "Game saved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ★ LOAD GAME ★
app.get('/api/load/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    res.status(200).json(user.gameSave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//  ──── ୨୧ ──── PASSWORD RESET ──── ୨୧ ────

// 💌 SEND EMAIL
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log(`🔎 1. Received request for: ${email}`);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(404).json({ message: "User not found" });
    }

    // Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes[email] = code; 
    console.log(`🔎 2. Generated Code: ${code}`);

    // Setup Gmail Sender 
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,       
      secure: true,       
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      logger: true,
      debug: true 
    });

    const mailOptions = {
      from: `"Rootlify" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🌱 Rootlify - Reset Code',
      text: `Hello Gardener!\n\nYour Password Reset Code is: ${code}\n\nGood luck!`
    };

    // SEND!
    console.log("🔎 3. Attempting to send to Gmail...");
    await transporter.sendMail(mailOptions);
    console.log(`✅ 4. Email successfully sent to ${email}`);
    
    res.json({ message: "Code sent to email" });

  } catch (err) {
    console.error("❌ CRASH AT STEP 3:", err); 
    // This will now show up in your Render logs!
    res.status(500).json({ message: "Could not send email", error: err.message });
  }
});

// 💌 VERIFY CODE
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (resetCodes[email] && resetCodes[email] === code) {
    return res.status(200).json({ message: "Code is valid" });
  } else {
    return res.status(400).json({ message: "Invalid or expired code" });
  }
});

// 💌 RESET PASSWORD (CHANGE IT)
app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    // Check code again
    if (resetCodes[email] !== code) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Encrypt New Password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    delete resetCodes[email]; // Clear code

    res.json({ message: "Password updated successfully!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

  // 💌 FORCE PASSWORD RESET (Frontend already verified the code)
app.post('/api/reset-password-force', async (req, res) => {
  const { email, newPassword } = req.body;
  
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Encrypt the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ──── ୨୧ ──── START SERVER ──── ୨୧ ────

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.log("❌ Error connecting to MongoDB");
    console.error(err);
  });
