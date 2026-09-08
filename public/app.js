// app.js - Single Page Application controller for Wedding Bingo
import { 
  registerUser, 
  loginUser, 
  logoutUser, 
  onAuthStateChangedListener, 
  saveGeneratedCards, 
  lockSelectedCard, 
  saveMarkedCells,
  subscribeToUserProfile,
  subscribeToCalledNumbers,
  callNumber,
  resetGame,
  saveAppsScriptUrl
} from "./db.js?v=2";

// ==========================================
// GAME CONSTANTS
// ==========================================
const WINNING_PATHS = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentUser = null;
let currentCalledNumbers = [];
let userProfileUnsubscribe = null;
let calledNumbersUnsubscribe = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const views = {
  auth: document.getElementById("auth-view"),
  selection: document.getElementById("selection-view"),
  game: document.getElementById("game-view"),
  host: document.getElementById("host-view"),
  gallery: document.getElementById("gallery-view")
};

const forms = {
  login: document.getElementById("login-form"),
  register: document.getElementById("register-form")
};

const buttons = {
  showRegister: document.getElementById("btn-show-register"),
  showLogin: document.getElementById("btn-show-login"),
  logout: document.getElementById("btn-logout"),
  checkBingo: document.getElementById("btn-check-bingo"),
  hostCallSubmit: document.getElementById("btn-call-number"),
  hostReset: document.getElementById("btn-host-reset"),
  confirmSelect: document.getElementById("btn-confirm-selection"),
  // Gallery and Upload elements
  openUpload: document.getElementById("btn-open-upload"),
  closeUpload: document.getElementById("btn-close-upload"),
  triggerFile: document.getElementById("btn-trigger-file"),
  sendCouple: document.getElementById("btn-send-couple"),
  changePhoto: document.getElementById("btn-change-photo"),
  uploadAnother: document.getElementById("btn-upload-another"),
  closePhoto: document.getElementById("btn-close-photo"),
  deletePhoto: document.getElementById("btn-delete-photo")
};

const ui = {
  navTabs: document.getElementById("app-navigation"),
  tabGame: document.getElementById("tab-game"),
  tabHost: document.getElementById("tab-host"),
  tabGallery: document.getElementById("tab-gallery"),
  userName: document.getElementById("display-user-name"),
  userEmail: document.getElementById("display-user-email"),
  cardSelectionContainer: document.getElementById("card-selection-container"),
  gameBoardGrid: document.getElementById("game-board-grid"),
  calledNumbersList: document.getElementById("called-numbers-list"),
  latestCalledNumber: document.getElementById("latest-called-number"),
  hostNumbersGrid: document.getElementById("host-numbers-grid"),
  hostInput: document.getElementById("host-number-input"),
  loginAlert: document.getElementById("login-alert"),
  registerAlert: document.getElementById("register-alert"),
  hostAlert: document.getElementById("host-alert"),
  modal: document.getElementById("result-modal"),
  modalClose: document.getElementById("btn-close-modal"),
  // Gallery DOM fields
  galleryGrid: document.getElementById("gallery-grid"),
  uploadModal: document.getElementById("upload-modal"),
  uploadFileInput: document.getElementById("upload-file-input"),
  uploadDropZone: document.getElementById("upload-drop-zone"),
  uploadPreviewImg: document.getElementById("upload-preview-img"),
  uploadLoadingText: document.getElementById("upload-loading-text"),
  photoViewModal: document.getElementById("photo-view-modal"),
  viewerImg: document.getElementById("viewer-img"),
  viewerCaption: document.getElementById("viewer-caption"),
  btnDownloadPhoto: document.getElementById("btn-download-photo")
};

// ==========================================
// INITIALIZATION & ROUTING
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  
  // Start observing auth state changes
  onAuthStateChangedListener((user, error) => {
    if (error) {
      ui.loginAlert.textContent = "Database Error: " + error.message;
      ui.loginAlert.className = "alert-msg danger";
    }
    handleAuthStateChange(user);
  });
});

function navigateTo(viewName) {
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.add("active");
    } else {
      views[key].classList.remove("active");
    }
  });
  
  // Configure global footer tab highlighting
  if (viewName === "game" || viewName === "host" || viewName === "gallery") {
    ui.navTabs.style.display = "flex";
    ui.tabGame.classList.toggle("active", viewName === "game");
    ui.tabGallery.classList.toggle("active", viewName === "gallery");
    ui.tabHost.classList.toggle("active", viewName === "host");
  } else {
    ui.navTabs.style.display = "none";
  }

  // Auto refresh gallery photos when entering the gallery view
  if (viewName === "gallery") {
    refreshGalleryGrid();
  }
}

function handleAuthStateChange(user) {
  // Clear existing active subscriptions
  if (userProfileUnsubscribe) userProfileUnsubscribe();
  if (calledNumbersUnsubscribe) calledNumbersUnsubscribe();
  
  currentUser = user;
  
  if (!user) {
    navigateTo("auth");
    currentUser = null;
    return;
  }
  
  // Setup user detail displays
  ui.userName.textContent = user.name;
  ui.userEmail.textContent = user.email;
  
  // Show host tab only for hosts
  if (user.role === "host") {
    ui.tabHost.style.display = "flex";
  } else {
    ui.tabHost.style.display = "none";
  }
  
  // Subscribe to real-time user updates (synced marks/card selection)
  userProfileUnsubscribe = subscribeToUserProfile(user.uid, (profile) => {
    currentUser = profile;
    handleViewRoutingForUser(profile);
  });
  
  // Subscribe to real-time called numbers & Google Drive settings
  calledNumbersUnsubscribe = subscribeToCalledNumbers((gameState) => {
    currentCalledNumbers = gameState.calledNumbers || [];
    liveAppsScriptUrl = gameState.appsScriptUrl || "";
    
    updateCalledNumbersUI(currentCalledNumbers);
    
    // Set the input field value in Host Panel if not focused
    const scriptUrlInput = document.getElementById("host-script-url-input");
    if (scriptUrlInput && !scriptUrlInput.matches(":focus")) {
      scriptUrlInput.value = liveAppsScriptUrl;
    }
    
    // If on host screen, refresh the full called numbers grid board
    if (views.host.classList.contains("active")) {
      renderHostDashboardGrid();
    }
  });
}

function handleViewRoutingForUser(profile) {
  // If the user is host, show the Host dashboard view as default, or Game if they switch
  if (profile.role === "host") {
    if (!views.host.classList.contains("active") && !views.game.classList.contains("active") && !views.gallery.classList.contains("active")) {
      navigateTo("host");
    }
    return;
  }
  
  // For guests:
  if (profile.selectedCardIndex === null || profile.selectedCardIndex === undefined) {
    // If no card chosen yet
    if (!profile.cards || Object.keys(profile.cards).length === 0) {
      // Generate and save 3 cards in Map format to prevent Firestore nested array error
      const generated = {
        "0": generateCard(),
        "1": generateCard(),
        "2": generateCard()
      };
      saveGeneratedCards(profile.uid, generated);
    } else {
      // It is a map, so we convert it to an array for rendering preview
      const cardsArray = [profile.cards["0"], profile.cards["1"], profile.cards["2"]];
      renderCardOptions(cardsArray);
      
      // Prevent snapping to selection screen if they are looking at the gallery
      if (!views.gallery.classList.contains("active")) {
        navigateTo("selection");
      }
    }
  } else {
    // Card chosen and locked in -> directly goes to the play game view
    const selectedCard = profile.cards[profile.selectedCardIndex.toString()];
    renderActiveGameBoard(selectedCard, profile.markedCells || []);
    
    // Only auto-navigate to game view if the user is NOT actively viewing the gallery!
    if (!views.gallery.classList.contains("active")) {
      navigateTo("game");
    }
  }
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
  // View Toggle links
  buttons.showRegister.addEventListener("click", () => {
    forms.login.style.display = "none";
    forms.register.style.display = "flex";
    ui.loginAlert.style.display = "none";
  });
  
  buttons.showLogin.addEventListener("click", () => {
    forms.register.style.display = "none";
    forms.login.style.display = "flex";
    ui.registerAlert.style.display = "none";
  });
  
  // Navigation tabs
  ui.tabGame.addEventListener("click", () => {
    if (currentUser) {
      if (currentUser.role === "host" || currentUser.selectedCardIndex !== null) {
        navigateTo("game");
      }
    }
  });
  
  ui.tabGallery.addEventListener("click", () => {
    if (currentUser) {
      navigateTo("gallery");
    }
  });
  
  ui.tabHost.addEventListener("click", () => {
    if (currentUser && currentUser.role === "host") {
      navigateTo("host");
    }
  });
  
  // Forms submit
  forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.loginAlert.style.display = "none";
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    try {
      await loginUser(email, password);
    } catch (err) {
      ui.loginAlert.textContent = err.message;
      ui.loginAlert.classList.add("danger");
    }
  });
  
  forms.register.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.registerAlert.style.display = "none";
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    
    try {
      await registerUser(name, email, password);
    } catch (err) {
      ui.registerAlert.textContent = err.message;
      ui.registerAlert.classList.add("danger");
    }
  });
  
  // Bind all sign out buttons globally
  document.querySelectorAll(".btn-logout-trigger").forEach(btn => {
    btn.addEventListener("click", async () => {
      await logoutUser();
    });
  });
  
  // Game Actions
  buttons.checkBingo.addEventListener("click", () => {
    performWinValidation();
  });
  
  // Host Actions
  buttons.hostCallSubmit.addEventListener("click", async () => {
    ui.hostAlert.style.display = "none";
    const num = parseInt(ui.hostInput.value);
    if (!num || num < 1 || num > 75) {
      ui.hostAlert.textContent = "Please enter a number between 1 and 75.";
      ui.hostAlert.className = "alert-msg danger";
      return;
    }
    
    try {
      await callNumber(num);
      ui.hostInput.value = "";
    } catch (err) {
      ui.hostAlert.textContent = err.message;
      ui.hostAlert.className = "alert-msg danger";
    }
  });
  
  buttons.hostReset.addEventListener("click", async () => {
    if (confirm("Are you absolutely sure you want to reset the wedding game? All guests' card selections and scores will be wiped!")) {
      await resetGame();
    }
  });
  
  // Modal Close
  ui.modalClose.addEventListener("click", () => {
    ui.modal.classList.remove("active");
  });

  // ==========================================
  // GALLERY & UPLOAD EVENTS
  // ==========================================
  
  // Open upload picker modal
  buttons.openUpload.addEventListener("click", () => {
    showUploadStep("select");
    ui.uploadModal.classList.add("active");
  });

  // Close upload modal
  buttons.closeUpload.addEventListener("click", () => {
    ui.uploadModal.classList.remove("active");
    resetUploadUI();
  });

  // Trigger file chooser
  buttons.triggerFile.addEventListener("click", () => {
    ui.uploadFileInput.click();
  });

  // Drag and drop or selection handler
  ui.uploadFileInput.addEventListener("change", handlePhotoSelection);
  ui.uploadDropZone.addEventListener("click", () => ui.uploadFileInput.click());

  // Polaroid change photo
  buttons.changePhoto.addEventListener("click", () => {
    resetUploadUI();
    showUploadStep("select");
  });

  // Share another photo
  buttons.uploadAnother.addEventListener("click", () => {
    resetUploadUI();
    showUploadStep("select");
  });

  // Confirm image send to couple
  buttons.sendCouple.addEventListener("click", async () => {
    await performPhotoUpload();
  });

  // Image viewer modal close
  buttons.closePhoto.addEventListener("click", () => {
    ui.photoViewModal.classList.remove("active");
  });

  // Save Apps Script Web App URL from Host Panel
  const btnSaveScriptUrl = document.getElementById("btn-save-script-url");
  if (btnSaveScriptUrl) {
    btnSaveScriptUrl.addEventListener("click", async () => {
      const alertEl = document.getElementById("host-script-alert");
      alertEl.style.display = "none";
      const urlVal = document.getElementById("host-script-url-input").value.trim();
      
      try {
        await saveAppsScriptUrl(urlVal);
        alertEl.textContent = "Google Drive Apps Script URL saved successfully!";
        alertEl.className = "alert-msg success";
      } catch (err) {
        alertEl.textContent = "Error saving URL: " + err.message;
        alertEl.className = "alert-msg danger";
      }
    });
  }
}

// ==========================================
// BINGO GAME GENERATION & LAYOUTS
// ==========================================

/**
 * Generate standard columns: B (1-15), I (16-30), N (31-45), G (46-60), O (61-75)
 */
function generateColumnNumbers(min, max, count) {
  const nums = [];
  while (nums.length < count) {
    const r = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!nums.includes(r)) {
      nums.push(r);
    }
  }
  return nums.sort((a, b) => a - b);
}

function generateCard() {
  const b = generateColumnNumbers(1, 15, 5);
  const i = generateColumnNumbers(16, 30, 5);
  const n = generateColumnNumbers(31, 45, 4); // Only need 4 numbers since center is FREE
  const g = generateColumnNumbers(46, 60, 5);
  const o = generateColumnNumbers(61, 75, 5);
  
  const card = [];
  // Row-major arrangement: 0..4 (row 0), 5..9 (row 1)...
  // For index x, column is (x % 5).
  // Column 0=B, 1=I, 2=N, 3=G, 4=O
  let nIndex = 0;
  for (let r = 0; r < 5; r++) {
    card.push(b[r]); // col 0
    card.push(i[r]); // col 1
    
    if (r === 2) {
      card.push("FREE"); // col 2 center
    } else {
      card.push(n[nIndex++]); // col 2 other
    }
    
    card.push(g[r]); // col 3
    card.push(o[r]); // col 4
  }
  return card;
}

// ==========================================
// RENDER VIEWS HANDLERS
// ==========================================

/**
 * Render 3 Card Options for selection screen
 */
let selectedOptionIndex = null;

function renderCardOptions(cards) {
  ui.cardSelectionContainer.innerHTML = "";
  selectedOptionIndex = null;
  buttons.confirmSelect.disabled = true;
  
  cards.forEach((card, index) => {
    const cardEl = document.createElement("div");
    cardEl.className = "card-option glass-panel";
    cardEl.dataset.index = index;
    
    // Grid HTML structure
    let gridHTML = `
      <div class="card-option-header">
        <h3>Option Card #${index + 1}</h3>
        <span class="card-badge">Choice #${index + 1}</span>
      </div>
      <div class="bingo-headers">
        <div class="bingo-header-letter">B</div>
        <div class="bingo-header-letter">I</div>
        <div class="bingo-header-letter">N</div>
        <div class="bingo-header-letter">G</div>
        <div class="bingo-header-letter">O</div>
      </div>
      <div class="bingo-grid mini-grid">
    `;
    
    card.forEach((num) => {
      const isFree = num === "FREE";
      gridHTML += `
        <div class="bingo-cell ${isFree ? 'free-space' : ''}">
          ${isFree ? 'FREE' : num}
        </div>
      `;
    });
    
    gridHTML += `</div>`;
    cardEl.innerHTML = gridHTML;
    
    // Tap to select logic
    cardEl.addEventListener("click", () => {
      document.querySelectorAll(".card-option").forEach(el => el.classList.remove("marked"));
      cardEl.classList.add("marked");
      selectedOptionIndex = index;
      buttons.confirmSelect.disabled = false;
    });
    
    ui.cardSelectionContainer.appendChild(cardEl);
  });
  
  // Re-bind confirm lock click once
  buttons.confirmSelect.onclick = async () => {
    if (selectedOptionIndex !== null && currentUser) {
      if (confirm("Are you sure? Once locked, you cannot change your board!")) {
        // Center cell "FREE" (index 12) is auto marked by default
        await lockSelectedCard(currentUser.uid, selectedOptionIndex);
        await saveMarkedCells(currentUser.uid, [12]);
      }
    }
  };
}

/**
 * Render Active locked Game Board Grid
 */
function renderActiveGameBoard(card, markedCells) {
  // If the host is viewing their own card, handle host values or let them play along
  ui.gameBoardGrid.innerHTML = "";
  
  // Render letter headers (B, I, N, G, O) inside standard header HTML
  card.forEach((num, index) => {
    const isFree = num === "FREE";
    const isMarked = markedCells.includes(index) || isFree;
    
    const cellEl = document.createElement("div");
    cellEl.className = `bingo-cell ${isFree ? 'free-space' : ''} ${isMarked ? 'marked' : ''}`;
    cellEl.textContent = isFree ? 'FREE' : num;
    cellEl.dataset.index = index;
    
    // Cell tap toggles
    cellEl.addEventListener("click", async () => {
      if (isFree) return; // FREE is immutable
      
      let updatedMarks = [...markedCells];
      if (updatedMarks.includes(index)) {
        updatedMarks = updatedMarks.filter(i => i !== index);
      } else {
        updatedMarks.push(index);
      }
      
      // Save instantly to database for persistence
      await saveMarkedCells(currentUser.uid, updatedMarks);
    });
    
    ui.gameBoardGrid.appendChild(cellEl);
  });
}

// ==========================================
// LATEST CALLED NUMBERS UI SYNC
// ==========================================
function updateCalledNumbersUI(calledNumbers) {
  ui.calledNumbersList.innerHTML = "";
  
  if (calledNumbers.length === 0) {
    ui.latestCalledNumber.textContent = "--";
    ui.calledNumbersList.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem; padding: 10px 0;">No numbers called yet.</span>`;
    return;
  }
  
  // Latest number displayed in golden circle
  const latestNum = calledNumbers[calledNumbers.length - 1];
  ui.latestCalledNumber.textContent = latestNum;
  
  // Horizontal list of prior numbers in reverse order
  const reversed = [...calledNumbers].reverse();
  reversed.forEach((num, idx) => {
    const bubble = document.createElement("div");
    bubble.className = `called-number-bubble ${idx === 0 ? 'latest' : ''}`;
    bubble.textContent = num;
    ui.calledNumbersList.appendChild(bubble);
  });
}

// ==========================================
// BINGO VALIDATION ENGINE
// ==========================================
function performWinValidation() {
  if (!currentUser || currentUser.selectedCardIndex === null) {
    showModal("Error", "You do not have a bingo card locked in yet!", true);
    return;
  }
  
  const userCard = currentUser.cards[currentUser.selectedCardIndex.toString()];
  const userMarks = currentUser.markedCells || [];
  
  // Find any fully marked paths in winning patterns
  let winningPathsFound = [];
  
  WINNING_PATHS.forEach(path => {
    const isPathFull = path.every(idx => userMarks.includes(idx) || idx === 12); // Free is cell 12
    if (isPathFull) {
      winningPathsFound.push(path);
    }
  });
  
  if (winningPathsFound.length === 0) {
    showModal("Not Yet!", "You haven't marked a full vertical, horizontal, or diagonal line of 5 numbers yet. Keep playing!", true);
    return;
  }
  
  // CROSS-REFERENCE WITH OFFICIAL HOST CALLED NUMBERS
  // Check if every non-free number in our winning paths has actually been officially called by host
  let invalidNumbers = [];
  let confirmedWinningPaths = [];
  
  winningPathsFound.forEach(path => {
    let pathIsLegit = true;
    
    path.forEach(cellIdx => {
      if (cellIdx === 12) return; // Skip FREE space
      
      const numValue = userCard[cellIdx];
      if (!currentCalledNumbers.includes(numValue)) {
        pathIsLegit = false;
        if (!invalidNumbers.includes(numValue)) {
          invalidNumbers.push(numValue);
        }
      }
    });
    
    if (pathIsLegit) {
      confirmedWinningPaths.push(path);
    }
  });
  
  if (confirmedWinningPaths.length > 0) {
    // We have a certified winner!
    showModal("BINGO!", `🍾 Congratulations ${currentUser.name}! Your card has a verified BINGO! Let the wedding party know! 🎉`, false);
  } else {
    // The player marked cells that were not actually called by the host!
    const numStr = invalidNumbers.join(", ");
    showModal("Verification Failed", `You claimed a Bingo, but these marked numbers on your line have NOT been officially called by the Host yet: ${numStr}. Nice try! 😉`, true);
  }
}

function showModal(title, desc, isError = false) {
  const icon = document.getElementById("modal-icon");
  const mTitle = document.getElementById("modal-title");
  const mDesc = document.getElementById("modal-desc");
  
  mTitle.textContent = title;
  mDesc.textContent = desc;
  
  if (isError) {
    icon.className = "modal-icon error";
    icon.textContent = "✕";
  } else {
    icon.className = "modal-icon victory";
    icon.textContent = "🏆";
  }
  
  ui.modal.classList.add("active");
}

// ==========================================
// HOST DASHBOARD GRID DRAW
// ==========================================
function renderHostDashboardGrid() {
  ui.hostNumbersGrid.innerHTML = "";
  
  // Loop 1 to 75
  for (let i = 1; i <= 75; i++) {
    const isCalled = currentCalledNumbers.includes(i);
    const cell = document.createElement("div");
    cell.className = `number-cell ${isCalled ? 'called' : ''}`;
    cell.textContent = i;
    
    // Quick double tap or click to call numbers directly from grid board
    cell.addEventListener("click", async () => {
      if (!isCalled) {
        if (confirm(`Do you want to officially draw and call Number ${i}?`)) {
          await callNumber(i);
        }
      }
    });
    
    ui.hostNumbersGrid.appendChild(cell);
  }
}

// ==========================================
// PHOTO GALLERY & UPLOAD MODULE (GOOGLE DRIVE & APPS SCRIPT)
// ==========================================

// --- GOOGLE DRIVE WEB API INTEGRATION URL ---
// Place your Google Apps Script Web App Deployment URL in the Host Dashboard.
// This matches live values synced from Firestore in real-time.
let liveAppsScriptUrl = "";

let currentUploadFile = null;

// Mock images for local development fallback
const MOCK_GALLERY_IMAGES = [
  { url: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=500&fit=crop", caption: "With these rings... 💍" },
  { url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=500&fit=crop", caption: "Holding hands forever 🌸" },
  { url: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=500&fit=crop", caption: "Our wedding cake! 🍰" },
  { url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&fit=crop", caption: "First dance as one ❤️" },
  { url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=500&fit=crop", caption: "Lovely reception tables ✨" },
  { url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=500&fit=crop", caption: "Sparkler send-off! 🎆" }
];

// In memory uploaded sandbox images
let localSandboxImages = [];

/**
 * Toggles visibility of modal steps
 */
/**
 * Toggles visibility of modal steps
 */
function showUploadStep(stepId) {
  const steps = ["select", "preview", "loading", "success"];
  steps.forEach(id => {
    const el = document.getElementById(`upload-step-${id}`);
    if (id === stepId) {
      el.classList.remove("hidden");
      el.style.display = "flex";
    } else {
      el.classList.add("hidden");
      el.style.display = "none";
    }
  });
}

/**
 * Resets file picker variables
 */
function resetUploadUI() {
  ui.uploadFileInput.value = "";
  ui.uploadPreviewImg.src = "";
  currentUploadFile = null;
}

/**
 * Handle Photo Selection
 */
function handlePhotoSelection(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  currentUploadFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    ui.uploadPreviewImg.src = event.target.result;
    showUploadStep("preview");
  };
  reader.readAsDataURL(file);
}

/**
 * SMART RESIZING LOGIC
 * High-performance canvas resizing using memory-efficient browser Object URLs
 */
function resizeImage(file, maxWidth = 1000) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    let blobURL = URL.createObjectURL(file);
    img.src = blobURL;
    
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Instantly revoke Blob URL to free mobile device memory
      URL.revokeObjectURL(blobURL);
      
      // High performance 0.75 JPEG quality - lightweight payload perfectly crisp on mobile screens
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(blobURL);
      reject(err);
    };
  });
}

/**
 * Perform Photo Upload
 */
async function performPhotoUpload() {
  if (!currentUploadFile) return;
  
  showUploadStep("loading");
  ui.uploadLoadingText.innerText = "Optimizing quality...";

  try {
    // Process and compress image memory-efficiently directly from the File object
    const optimizedData = await resizeImage(currentUploadFile, 1000);
    ui.uploadLoadingText.innerText = "Sending to Hendry & Valensia...";

    const fileName = "wedding_" + Date.now() + ".jpg";
    
    // 1. Dual Mode: Inside Google Apps Script iframe
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(() => {
          showUploadStep("success");
          refreshGalleryGrid();
        })
        .withFailureHandler((err) => {
          alert("Connection lost. Please try again!");
          showUploadStep("preview");
        })
        .uploadFile(optimizedData, fileName);
    } 
    // 2. Dual Mode: Standalone web app making external POST request to Apps Script Web App URL
    else if (liveAppsScriptUrl) {
      fetch(liveAppsScriptUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "upload",
          fileData: optimizedData,
          fileName: fileName
        }),
        headers: {
          "Content-Type": "text/plain"
        }
      })
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          throw new Error(result.error);
        }
        showUploadStep("success");
        // Force refresh gallery locally after a short buffer to allow Drive writes to finalize
        setTimeout(refreshGalleryGrid, 1500);
      })
      .catch(err => {
        console.error("External upload failed:", err);
        alert("Upload failed: " + err.message);
        showUploadStep("preview");
      });
    } 
    // 3. Sandbox local simulation fallback
    else {
      // Simulate sending on local sandbox preview
      setTimeout(() => {
        localSandboxImages.unshift({
          url: optimizedData,
          caption: `Captured by ${currentUser ? currentUser.name : "Guest"}`
        });
        showUploadStep("success");
        refreshGalleryGrid();
      }, 2000);
    }
  } catch (err) {
    console.error("Image compression failed:", err);
    alert("Could not process image. Please try another one!");
    showUploadStep("preview");
  }
}

/**
 * Fetch and refresh the masonry gallery image grid
 */
function refreshGalleryGrid() {
  ui.galleryGrid.innerHTML = "";

  // Helper method to dynamically render fetched image lists
  const renderImages = (base64Images) => {
    if (!base64Images || base64Images.length === 0) {
      ui.galleryGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--ink-secondary); padding: 40px 0;">No photos shared yet. Be the first!</div>`;
      return;
    }
    
    base64Images.forEach((imgSrc, idx) => {
      const imgEl = document.createElement("img");
      imgEl.src = imgSrc;
      imgEl.loading = "lazy";
      imgEl.alt = "Wedding Memory";
      imgEl.addEventListener("click", () => {
        openPhotoViewer(imgSrc, `Memory #${base64Images.length - idx}`);
      });
      ui.galleryGrid.appendChild(imgEl);
    });
  };

  // 1. Dual Mode: Inside Google Apps Script iframe
  if (typeof google !== 'undefined' && google.script && google.script.run && google.script.run.getImagesForGallery) {
    google.script.run
      .withSuccessHandler((base64Images) => {
        renderImages(base64Images);
      })
      .withFailureHandler((err) => {
        console.error("Failed to load Google Drive gallery:", err);
        renderMockGallery();
      })
      .getImagesForGallery();
  } 
  // 2. Dual Mode: Fetch live images externally from deployed Apps Script Web App API URL (JSONP bypasses CORS)
  else if (liveAppsScriptUrl) {
    const callbackName = "gasGalleryCallback_" + Date.now();
    window[callbackName] = (base64Images) => {
      renderImages(base64Images);
      delete window[callbackName];
      const scriptEl = document.getElementById(scriptId);
      if (scriptEl) scriptEl.remove();
    };
    
    const scriptId = "gas-jsonp-script";
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();
    
    const script = document.createElement("script");
    script.id = scriptId;
    const connector = liveAppsScriptUrl.indexOf("?") > -1 ? "&" : "?";
    script.src = `${liveAppsScriptUrl}${connector}action=getImages&callback=${callbackName}`;
    script.onerror = (err) => {
      console.error("Failed to load live Google Drive gallery via JSONP:", err);
      renderMockGallery();
    };
    document.body.appendChild(script);
  } 
  // 3. Fallback mock preview
  else {
    renderMockGallery();
  }
}

function renderMockGallery() {
  const images = [...localSandboxImages, ...MOCK_GALLERY_IMAGES];
  
  images.forEach((imgData) => {
    const imgEl = document.createElement("img");
    imgEl.src = imgData.url;
    imgEl.loading = "lazy";
    imgEl.alt = imgData.caption;
    imgEl.addEventListener("click", () => {
      openPhotoViewer(imgData.url, imgData.caption);
    });
    ui.galleryGrid.appendChild(imgEl);
  });
}

/**
 * Opens full resolution Polaroid modal viewer
 */
function openPhotoViewer(imgUrl, caption) {
  ui.viewerImg.src = imgUrl;
  ui.viewerCaption.textContent = caption;
  ui.btnDownloadPhoto.href = imgUrl;
  ui.btnDownloadPhoto.download = "wedding_" + Date.now() + ".jpg";
  ui.photoViewModal.classList.add("active");
}
