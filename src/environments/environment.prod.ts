export const environment = {
  production: true,
  firebaseConfig: {
  
     apiKey: "AIzaSyAmXyY8D1NxqlBVrJpALiSxM-7qRB1inr4",
  authDomain: "room-manager-9d417.firebaseapp.com",
  projectId: "room-manager-9d417",
  storageBucket: "room-manager-9d417.firebasestorage.app",
  messagingSenderId: "713880758367",
  appId: "1:713880758367:web:595534eb6d93c33e4ed3ea",
  },
  vapidKey: 'BECsyfOuBKgOYx7DdRZ-o8tUBccfinmcMYq4Ig11nnqSI3sdDHztSjwN_JghGY34lUYoyFiLQS_Hl1g-TPn5eDs',

    cloudinary: {
    cloudName: 'eaqx7g3j',
    uploadPreset: 'nestly_uploads',
  },

  // PHASE 4 — base URL of the deployed Nestly push backend (expense-notification-backend
  // on Render), used ONLY by VoiceAiService for POST /api/voice/interpret.
  // TODO: confirm this matches your actual Render service URL before deploying —
  // it's inferred from render.yaml's service name ("nestly-push-backend") and
  // Render's URL convention, not verified against a live deployment.
  voiceAiApiUrl: 'https://nestly-push-backend.onrender.com',
};
