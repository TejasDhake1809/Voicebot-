Backend Setup (voicebot-node)
1. Install dependencies
cd voicebot-node
npm install

2. Create .env
PORT=8000
MONGO_URI=mongodb://localhost:27017/voicebot
GEMINI_API_KEY=your_gemini_key
DEEPGRAM_API_KEY=your_deepgram_key
JWT_SECRET=your_secret

3. Create upload folders
mkdir -p uploads/idproofs
mkdir -p uploads/audio

4. Start MongoDB

(Make sure MongoDB is running locally.)

5. Start backend
node server.js


Backend runs at:

http://localhost:8000

Frontend Setup (voicebot-frontend)
1. Install dependencies
cd voicebot-frontend
npm install

2. Start development server
npm run dev


Frontend runs at:

http://localhost:5173
