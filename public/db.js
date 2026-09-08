// db.js - Database and Authentication wrapper supporting Firebase & Offline Emulation fallback
import { auth, db, isEmulated } from "./firebase-config.js?v=2";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// EMULATION STATE UTILITIES (LOCAL STORAGE)
// ==========================================
const LOCAL_USERS_KEY = "wedding_bingo_emulated_users";
const CURRENT_USER_KEY = "wedding_bingo_emulated_current_user";
const GAME_STATE_KEY = "wedding_bingo_emulated_game";

const getLocalUsers = () => JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
const saveLocalUsers = (users) => localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

const getLocalGameState = () => JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{"calledNumbers": []}');
const saveLocalGameState = (state) => localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));

// Ensure default game state exists in emulation mode
if (!localStorage.getItem(GAME_STATE_KEY)) {
  saveLocalGameState({ calledNumbers: [] });
}

// Active listeners cache for emulated data changes
const emulatedListeners = new Set();

// ==========================================
// DB INTERFACE EXPORTS
// ==========================================

/**
 * Register a new user (guest or host)
 */
export async function registerUser(name, email, password, role = "guest") {
  email = email.trim().toLowerCase();
  
  if (isEmulated) {
    const users = getLocalUsers();
    if (users.some(u => u.email === email)) {
      throw new Error("Email already registered in local sandbox.");
    }
    const uid = "emulated_" + Math.random().toString(36).substring(2, 9);
    const newUser = {
      uid,
      name,
      email,
      password, // Stored plain text only in local sandbox for emulation purposes
      role,
      selectedCardIndex: null,
      cards: [],
      markedCells: []
    };
    users.push(newUser);
    saveLocalUsers(users);
    
    // Set current session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    triggerEmulatedListeners();
    return newUser;
  } else {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const userData = {
      uid,
      name,
      email,
      role,
      selectedCardIndex: null,
      cards: {},
      markedCells: []
    };
    await setDoc(doc(db, "users", uid), userData);
    return userData;
  }
}

/**
 * Login existing user
 */
export async function loginUser(email, password) {
  email = email.trim().toLowerCase();
  
  if (isEmulated) {
    // Special dev trick: typing "admin@wedding.com" logs in as host if user doesn't exist
    if (email === "admin@wedding.com") {
      const users = getLocalUsers();
      let hostUser = users.find(u => u.email === email);
      if (!hostUser) {
        hostUser = {
          uid: "host_emulated",
          name: "Wedding Host",
          email: "admin@wedding.com",
          role: "host",
          selectedCardIndex: null,
          cards: [],
          markedCells: []
        };
        users.push(hostUser);
        saveLocalUsers(users);
      }
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(hostUser));
      triggerEmulatedListeners();
      return hostUser;
    }
    
    const users = getLocalUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      throw new Error("Invalid email or password.");
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    triggerEmulatedListeners();
    return user;
  } else {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userSnap = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userSnap.exists()) {
        return userSnap.data();
      } else {
        throw new Error("User record not found in database.");
      }
    } catch (error) {
      // Auto-register admin account on first try
      if (email === "admin@wedding.com" && (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const userData = {
            uid: userCredential.user.uid,
            name: "Admin",
            email: email,
            role: "host",
            selectedCardIndex: null,
            cards: {},
            markedCells: []
          };
          await setDoc(doc(db, "users", userCredential.user.uid), userData);
          return userData;
        } catch (createError) {
          // If it fails to create (e.g. password too weak), throw the original error
          if (createError.code === 'auth/email-already-in-use') {
            throw new Error("Invalid password for admin.");
          }
          throw createError;
        }
      }
      throw error;
    }
  }
}

/**
 * Sign out user
 */
export async function logoutUser() {
  if (isEmulated) {
    localStorage.removeItem(CURRENT_USER_KEY);
    triggerEmulatedListeners();
  } else {
    await signOut(auth);
  }
}

/**
 * Subscribe to current auth state
 */
export function onAuthStateChangedListener(callback) {
  if (isEmulated) {
    const checkAuth = () => {
      const userJSON = localStorage.getItem(CURRENT_USER_KEY);
      if (userJSON) {
        const user = JSON.parse(userJSON);
        callback(user);
      } else {
        callback(null);
      }
    };
    
    // Listen to local changes
    emulatedListeners.add(checkAuth);
    checkAuth(); // Call immediately
    
    return () => {
      emulatedListeners.delete(checkAuth);
    };
  } else {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch custom user attributes from Firestore
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            // --- AUTOMATIC HOST ROLE SYNC ---
            if (data.email === "admin@wedding.com" && data.role !== "host") {
              console.log("Auto-elevating admin@wedding.com to host role...");
              await updateDoc(doc(db, "users", firebaseUser.uid), { role: "host" });
              data.role = "host";
            }
            callback(data);
          } else {
            // If the admin@wedding.com logged in but their user profile document is missing:
            if (firebaseUser.email === "admin@wedding.com") {
              console.log("Auto-creating host user document in Firestore...");
              const hostData = {
                uid: firebaseUser.uid,
                name: "Admin",
                email: "admin@wedding.com",
                role: "host",
                selectedCardIndex: null,
                cards: {},
                markedCells: []
              };
              await setDoc(doc(db, "users", firebaseUser.uid), hostData);
              callback(hostData);
            } else {
              console.warn("Firestore user document does not exist for uid:", firebaseUser.uid);
              callback(null);
            }
          }
        } catch (error) {
          console.error("Error fetching Firestore user document inside auth listener:", error);
          // Pass the error to the UI callback so it can be displayed to the user
          callback(null, error);
        }
      } else {
        callback(null);
      }
    });
  }
}

/**
 * Save the 3 generated bingo cards for selection
 */
export async function saveGeneratedCards(uid, cards) {
  if (isEmulated) {
    updateLocalUser(uid, { cards });
  } else {
    await updateDoc(doc(db, "users", uid), { cards });
  }
}

/**
 * Lock user's card selection
 */
export async function lockSelectedCard(uid, cardIndex) {
  if (isEmulated) {
    updateLocalUser(uid, { selectedCardIndex: cardIndex });
  } else {
    await updateDoc(doc(db, "users", uid), { selectedCardIndex: cardIndex });
  }
}

/**
 * Save current marked cells grid structure (array of indices marked 0-24)
 */
export async function saveMarkedCells(uid, markedCells) {
  if (isEmulated) {
    updateLocalUser(uid, { markedCells });
  } else {
    await updateDoc(doc(db, "users", uid), { markedCells });
  }
}

/**
 * Listen to a single user profile (live sync marks/cards)
 */
export function subscribeToUserProfile(uid, callback) {
  if (isEmulated) {
    const checkProfile = () => {
      // Abort if session is no longer active (prevents logout race conditions)
      if (!localStorage.getItem(CURRENT_USER_KEY)) {
        return;
      }
      const users = getLocalUsers();
      const user = users.find(u => u.uid === uid);
      if (user) {
        // Sync session cache just in case
        const sessionUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "{}");
        if (sessionUser.uid === uid) {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        }
        callback(user);
      }
    };
    emulatedListeners.add(checkProfile);
    checkProfile();
    return () => {
      emulatedListeners.delete(checkProfile);
    };
  } else {
    return onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      }
    });
  }
}

/**
 * Subscribe to the official host called numbers
 */
export function subscribeToCalledNumbers(callback) {
  if (isEmulated) {
    const checkNumbers = () => {
      const state = getLocalGameState();
      callback(state);
    };
    emulatedListeners.add(checkNumbers);
    checkNumbers();
    return () => {
      emulatedListeners.delete(checkNumbers);
    };
  } else {
    return onSnapshot(doc(db, "games", "wedding_bingo"), (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      } else {
        // Simply return empty defaults, do NOT write to database from Guest view (violates security rules)
        callback({ calledNumbers: [] });
      }
    });
  }
}

/**
 * Host only: Save external Google Apps Script Web App Deployment URL in Firestore
 */
export async function saveAppsScriptUrl(url) {
  if (isEmulated) {
    const state = getLocalGameState();
    state.appsScriptUrl = url;
    saveLocalGameState(state);
    triggerEmulatedListeners();
  } else {
    await setDoc(doc(db, "games", "wedding_bingo"), {
      appsScriptUrl: url
    }, { merge: true });
  }
}

/**
 * Host only: Call a new number
 */
export async function callNumber(number) {
  number = parseInt(number);
  if (isNaN(number) || number < 1 || number > 75) {
    throw new Error("Invalid number. Must be between 1 and 75.");
  }
  
  if (isEmulated) {
    const state = getLocalGameState();
    if (!state.calledNumbers.includes(number)) {
      state.calledNumbers.push(number);
      saveLocalGameState(state);
      triggerEmulatedListeners();
    }
  } else {
    await setDoc(doc(db, "games", "wedding_bingo"), {
      calledNumbers: arrayUnion(number)
    }, { merge: true });
  }
}

/**
 * Host only: Reset global game called numbers list
 */
export async function resetGame() {
  if (isEmulated) {
    saveLocalGameState({ calledNumbers: [] });
    // Reset all users' marked state & cards
    const users = getLocalUsers().map(u => ({
      ...u,
      selectedCardIndex: null,
      cards: [],
      markedCells: []
    }));
    saveLocalUsers(users);
    
    // Reset current active session too
    const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
    if (currentUser) {
      currentUser.selectedCardIndex = null;
      currentUser.cards = [];
      currentUser.markedCells = [];
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    }
    
    triggerEmulatedListeners();
  } else {
    await setDoc(doc(db, "games", "wedding_bingo"), { calledNumbers: [] });
    // Note: In real firebase, we'd reset players if needed, or players can do it.
    // To make it simple, resetting game calledNumbers resets logic.
  }
}

// ==========================================
// EMULATION HELPERS
// ==========================================
function updateLocalUser(uid, updates) {
  const users = getLocalUsers();
  const index = users.findIndex(u => u.uid === uid);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    saveLocalUsers(users);
    
    // Also sync standard current user session
    const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "{}");
    if (currentUser.uid === uid) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[index]));
    }
    triggerEmulatedListeners();
  }
}

function triggerEmulatedListeners() {
  emulatedListeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.error("Error executing emulated data listener:", e);
    }
  });
}
