let poems = [];
let currentPoem = null;
let currentMode = "input"; // "input" or "select"
let currentDifficulty = "medium";
let blanks = []; // Stores {lineIndex, charIndex, correctChar, inputElement}
let lastFocusedInput = null; // Track the last focused input for handwriting insertion
let handwritingCanvas = null; // Handwriting canvas instance
let recentPoemIndices = []; // Track recently used poem indices
const MAX_RECENT_HISTORY = 20; // Ensure no repeats within this many turns

// Initialize cnchar resource base - Not needed for basic features anymore
// if (typeof cnchar !== "undefined") {
//   cnchar.setResourceBase("https://cdn.jsdelivr.net/npm/cnchar-data@latest/");
// }

// Load poems based on selection
function loadPoems() {
  const librarySelect = document.getElementById("library-select");
  const selectedLibrary = librarySelect ? librarySelect.value : "primary";

  updatePoemsData(selectedLibrary);

  if (poems.length > 0) {
    initGame();
  } else {
    // If init failed, message is already set in updatePoemsData or below
    if (!document.getElementById("message-area").textContent) {
      document.getElementById("message-area").textContent = "加载诗词数据失败";
    }
  }
}

function updatePoemsData(libraryType) {
  let newPoems = [];
  if (libraryType === "primary" && typeof poemsPrimary !== "undefined") {
    newPoems = poemsPrimary;
  } else if (libraryType === "tang300" && typeof poemsTang !== "undefined") {
    newPoems = poemsTang;
  } else if (libraryType === "song300" && typeof poemsSong !== "undefined") {
    newPoems = poemsSong;
  } else if (typeof poemsData !== "undefined") {
    // Fallback for backward compatibility if poemsData exists
    newPoems = poemsData;
  }

  if (newPoems.length > 0) {
    poems = newPoems;
    recentPoemIndices = []; // Reset history when library changes
  } else {
    console.error(`Library ${libraryType} not found or empty`);
    document.getElementById("message-area").textContent =
      `无法加载诗词库: ${libraryType}`;
    poems = [];
  }
}

// Initialize game state
function initGame() {
  const librarySelect = document.getElementById("library-select");
  if (librarySelect) {
    librarySelect.addEventListener("change", (e) => {
      updatePoemsData(e.target.value);
      if (poems.length > 0) {
        startNewGame();
        // Also update search list if modal is open (optional but good UX)
        // But renderPoemList reads global `poems`, so we just need to re-render if open
        const modal = document.getElementById("poem-picker-modal");
        if (modal && !modal.classList.contains("hidden")) {
          renderPoemList(document.getElementById("poem-search").value);
        }
      }
    });
  }

  const difficultySelect = document.getElementById("difficulty-select");
  if (difficultySelect) {
    difficultySelect.addEventListener("change", (e) => {
      currentDifficulty = e.target.value;
      // Just re-render the current poem with new difficulty, don't switch poem
      if (currentPoem) {
        renderPoem();
        document.getElementById("message-area").textContent = "";
        document.getElementById("message-area").className = "";
        lastFocusedInput = null;
      } else {
        startNewGame();
      }
    });
  }

  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    // Initialize mode from select element to ensure sync
    currentMode = modeSelect.value;
    updateModeUI();

    modeSelect.addEventListener("change", (e) => {
      const newMode = e.target.value;

      // Warning when switching to or from sort mode
      if (currentMode === "sort" || newMode === "sort") {
        e.preventDefault(); // Prevent implicit change logic if any, though select value changed already

        // Revert visual selection first
        e.target.value = currentMode;

        showConfirmModal("切换模式将重置当前进度的输入记录，是否继续？", () => {
          currentMode = newMode;
          modeSelect.value = newMode; // Set to new mode visually
          updateModeUI();
          renderPoem();
        });
        return;
      }

      currentMode = newMode;
      updateModeUI();

      // If switching to sort mode, we must re-render to show the shuffled poem
      // If switching FROM sort mode, we must re-render to show the normal input boxes
      if (currentMode === "sort" || currentMode !== "sort") {
        renderPoem();
      }
    });
  }

  const poolPositionSelect = document.getElementById("pool-position-select");
  if (poolPositionSelect) {
    poolPositionSelect.addEventListener("change", (e) => {
      updatePoolPosition(e.target.value);
    });
    // Initialize position
    updatePoolPosition(poolPositionSelect.value);
  } else {
    // Default to bottom if select not found
    updatePoolPosition("bottom");
  }

  document
    .getElementById("new-game-btn")
    .addEventListener("click", startNewGame);
  // Check Button
  document.getElementById("check-btn").addEventListener("click", checkAnswers);

  // Pick Poem Button
  document
    .getElementById("pick-poem-btn")
    .addEventListener("click", openPoemPicker);

  // Close Modal Button
  document
    .querySelector(".close-modal")
    .addEventListener("click", closePoemPicker);

  // Close modal when clicking outside
  document
    .getElementById("poem-picker-modal")
    .addEventListener("click", (e) => {
      if (e.target.id === "poem-picker-modal") {
        closePoemPicker();
      }
    });

  // Search input listener
  document.getElementById("poem-search").addEventListener("input", (e) => {
    renderPoemList(e.target.value);
  });

  document
    .getElementById("restart-btn")
    .addEventListener("click", restartCurrentGame);
  document.getElementById("hint-btn").addEventListener("click", showHint);
  document
    .getElementById("hint-char-btn")
    .addEventListener("click", showCharHint);

  // Handwriting UI events
  document
    .getElementById("hw-clear-btn")
    .addEventListener("click", clearHandwriting);
  document
    .getElementById("hw-undo-btn")
    .addEventListener("click", undoHandwriting);

  // Stroke Order UI events
  const hwStrokeBtn = document.getElementById("hw-stroke-btn");
  if (hwStrokeBtn) {
    hwStrokeBtn.addEventListener("click", () => {
      if (lastFocusedInput && lastFocusedInput.value) {
        showStrokeOrder(lastFocusedInput.value);
      } else {
        // Feedback for user if button is visible but state is invalid (rare edge case)
        const msgArea = document.getElementById("message-area");
        if (msgArea) {
          msgArea.textContent = "请先选中一个有字的格子";
          msgArea.style.color = "var(--primary-color)";
        }
      }
    });
  }

  const hwPinyinBtn = document.getElementById("hw-pinyin-btn");
  if (hwPinyinBtn) {
    hwPinyinBtn.addEventListener("click", () => {
      if (lastFocusedInput && lastFocusedInput.value) {
        showPinyin(lastFocusedInput.value);
      } else {
        const msgArea = document.getElementById("message-area");
        if (msgArea) {
          msgArea.textContent = "请先选中一个有字的格子";
          msgArea.style.color = "var(--primary-color)";
        }
      }
    });
  }

  const closeStrokeModal = document.querySelector(".close-stroke-modal");
  if (closeStrokeModal) {
    closeStrokeModal.addEventListener("click", () => {
      document.getElementById("stroke-order-modal").classList.add("hidden");
    });
  }

  const replayStrokeBtn = document.getElementById("replay-stroke-btn");
  if (replayStrokeBtn) {
    replayStrokeBtn.addEventListener("click", () => {
      if (strokeWriter) {
        strokeWriter.animateLoop();
      }
    });
  }

  const strokeModal = document.getElementById("stroke-order-modal");
  if (strokeModal) {
    strokeModal.addEventListener("click", (e) => {
      if (e.target.id === "stroke-order-modal") {
        strokeModal.classList.add("hidden");
      }
    });
  }

  // Grid style selector
  const gridSelect = document.getElementById("grid-style-select");
  if (gridSelect) {
    gridSelect.addEventListener("change", (e) => {
      const canvas = document.getElementById("handwriting-canvas");
      canvas.className = ""; // clear all
      canvas.classList.add(`grid-${e.target.value}`);
    });
  }

  // Initialize Handwriting Canvas
  initHandwritingCanvas();

  // Listen for window resize to adjust layout
  window.addEventListener("resize", () => {
    // Debounce slightly or just run
    adjustLayout();
  });

  startNewGame();
}

let hwContext = null;
let isWriting = false;
let currentStrokes = []; // Array of strokes for HanziLookup (arrays of [x,y])
let currentStrokesSys = []; // Array of strokes for System API (arrays of {x,y,t})
let currentStroke = []; // Current stroke for HanziLookup
let currentStrokeSys = []; // Current stroke for System API
let lastPoint = null;
let handwritingRecognizer = null; // System handwriting recognizer
let currentTracingChar = ""; // Char to display as background for tracing
let strokeWriter = null; // HanziWriter instance for stroke order animation

function setTracingChar(char) {
  currentTracingChar = char;
  if (currentMode === "handwriting") {
    clearHandwriting();
  }
}

function drawTracingChar() {
  if (!currentTracingChar || !hwContext) return;
  const canvas = document.getElementById("handwriting-canvas");

  hwContext.save();
  hwContext.font = "300px Kaiti, STKaiti, KaiTi, serif";
  hwContext.fillStyle = "rgba(0, 0, 0, 0.08)";
  hwContext.textAlign = "center";
  hwContext.textBaseline = "middle";
  // Slightly adjust y to center visually (move up a bit)
  hwContext.fillText(currentTracingChar, canvas.width / 2, canvas.height / 2);
  hwContext.restore();
}

async function initSystemHandwriting() {
  if (!("createHandwritingRecognizer" in navigator)) return;
  try {
    const constraint = { languages: ["zh-CN"] };
    const supported = await navigator.queryHandwritingRecognizer(constraint);
    if (supported) {
      handwritingRecognizer =
        await navigator.createHandwritingRecognizer(constraint);
      console.log("System Handwriting Recognizer initialized");
    }
  } catch (e) {
    console.error("System HW init failed", e);
  }
}

function initHandwritingCanvas() {
  // Initialize System Recognizer
  initSystemHandwriting();

  const canvas = document.getElementById("handwriting-canvas");
  if (!canvas) return;

  hwContext = canvas.getContext("2d");
  hwContext.lineWidth = 5;
  hwContext.lineCap = "round";
  hwContext.lineJoin = "round";
  hwContext.strokeStyle = "#000";

  // Mouse events
  canvas.addEventListener("mousedown", startWriting);
  canvas.addEventListener("mousemove", writing);
  canvas.addEventListener("mouseup", stopWriting);
  canvas.addEventListener("mouseleave", stopWriting);

  // Touch events
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      startWriting({ clientX: touch.clientX, clientY: touch.clientY });
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      writing({ clientX: touch.clientX, clientY: touch.clientY });
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      stopWriting();
    },
    { passive: false },
  );

  // Initialize HanziLookup
  if (typeof HanziLookup !== "undefined") {
    HanziLookup.init(
      "mmah",
      "https://cdn.jsdelivr.net/gh/gugray/HanziLookupJS@master/dist/mmah.json",
      (success) => {
        if (!success) {
          console.error("Failed to load HanziLookup data");
        }
      },
    );
  }
}

function getCanvasCoordinates(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function startWriting(e) {
  isWriting = true;
  const canvas = document.getElementById("handwriting-canvas");
  const coords = getCanvasCoordinates(e, canvas);
  lastPoint = coords;
  currentStroke = [[coords.x, coords.y]];
  currentStrokeSys = [{ x: coords.x, y: coords.y, t: Date.now() }];

  hwContext.beginPath();
  hwContext.moveTo(coords.x, coords.y);
}

function writing(e) {
  if (!isWriting) return;
  const canvas = document.getElementById("handwriting-canvas");
  const coords = getCanvasCoordinates(e, canvas);

  // Distance-based sampling (Smoothing) to reduce jitter and improve recognition
  const dx = coords.x - lastPoint.x;
  const dy = coords.y - lastPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 5) return; // Ignore small movements

  hwContext.lineTo(coords.x, coords.y);
  hwContext.stroke();

  currentStroke.push([coords.x, coords.y]);
  currentStrokeSys.push({ x: coords.x, y: coords.y, t: Date.now() });
  lastPoint = coords;
}

function stopWriting() {
  if (!isWriting) return;
  isWriting = false;
  hwContext.closePath();

  if (currentStroke.length > 0) {
    currentStrokes.push(currentStroke);
    currentStrokesSys.push(currentStrokeSys);
  }
  currentStroke = [];
  currentStrokeSys = [];

  // Auto-recognize after each stroke for better UX? Or wait for confirm?
  // Let's do auto-recognize to show candidates
  recognizeHandwriting();
}

function clearHandwriting() {
  const canvas = document.getElementById("handwriting-canvas");
  hwContext.clearRect(0, 0, canvas.width, canvas.height);
  drawTracingChar();
  currentStrokes = [];
  currentStrokesSys = [];
  document.getElementById("hw-candidates").innerHTML = "";
}

function undoHandwriting() {
  if (currentStrokes.length === 0) return;
  currentStrokes.pop();
  currentStrokesSys.pop();

  const canvas = document.getElementById("handwriting-canvas");
  hwContext.clearRect(0, 0, canvas.width, canvas.height);
  drawTracingChar();

  currentStrokes.forEach((stroke) => {
    if (stroke.length === 0) return;
    hwContext.beginPath();
    hwContext.moveTo(stroke[0][0], stroke[0][1]);
    for (let i = 1; i < stroke.length; i++) {
      hwContext.lineTo(stroke[i][0], stroke[i][1]);
    }
    hwContext.stroke();
  });

  recognizeHandwriting();
}

function showHandwritingBoard() {
  document.getElementById("handwriting-container").classList.remove("hidden");
  clearHandwriting();
}

async function recognizeHandwriting() {
  const candidatesDiv = document.getElementById("hw-candidates");
  if (currentStrokes.length === 0) {
    candidatesDiv.innerHTML = "";
    return;
  }

  candidatesDiv.innerHTML = "";
  const existingCandidates = new Set();

  const addCandidate = (char) => {
    if (existingCandidates.has(char)) return;
    existingCandidates.add(char);

    const btn = document.createElement("div");
    btn.className = "candidate-char";
    btn.textContent = char;
    btn.addEventListener("click", () => {
      if (lastFocusedInput) {
        playSound("select");
        lastFocusedInput.value = char;
        // Trigger input logic
        const event = new Event("input", { bubbles: true });
        lastFocusedInput.dispatchEvent(event);
        clearHandwriting();
        updateStrokeBtnVisibility();
      }
    });
    candidatesDiv.appendChild(btn);
  };

  // 1. Try System Handwriting API
  if (handwritingRecognizer && currentStrokesSys.length > 0) {
    try {
      const drawing = handwritingRecognizer.startDrawing();
      for (const strokePoints of currentStrokesSys) {
        // Create a HandwritingStroke object if available
        if (typeof HandwritingStroke !== "undefined") {
          const stroke = new HandwritingStroke();
          for (const point of strokePoints) {
            stroke.addPoint(point);
          }
          drawing.addStroke(stroke);
        } else {
          // Fallback for older implementations (if any)
          // or if HandwritingStroke is not globally exposed
          drawing.addStroke(strokePoints);
        }
      }
      const predictions = await drawing.getPrediction();
      if (predictions && predictions.length > 0) {
        predictions.forEach((p) => addCandidate(p.text));
      }
    } catch (e) {
      console.error("System HW recognition failed", e);
    }
  }

  // 2. Fallback/Supplement with HanziLookup
  if (typeof HanziLookup !== "undefined") {
    const analyzedChar = new HanziLookup.AnalyzedCharacter(currentStrokes);
    const matcher = new HanziLookup.Matcher("mmah");

    matcher.match(analyzedChar, 24, (matches) => {
      matches.forEach((match) => addCandidate(match.character));
    });
  } else if (existingCandidates.size === 0) {
    alert("手写识别库加载失败，请检查网络");
  }
}

function updatePoolPosition(position) {
  const body = document.body;
  // Remove all position classes
  body.classList.remove("pool-bottom", "pool-left", "pool-right");
  // Add new position class
  body.classList.add(`pool-${position}`);

  // Adjust layout after position change
  requestAnimationFrame(() => {
    adjustLayout();
  });
}

function displayCandidates(candidates) {
  const list = document.getElementById("candidate-words");
  list.innerHTML = "";

  candidates.forEach((char) => {
    const btn = document.createElement("button");
    btn.textContent = char;
    btn.className = "candidate-btn";
    btn.addEventListener("click", () => {
      insertCharacter(char);
      handwritingCanvas.erase(); // Auto clear after pick? Maybe better UX
      list.innerHTML = ""; // Clear candidates
    });
    list.appendChild(btn);
  });
}

function insertCharacter(char) {
  if (lastFocusedInput) {
    lastFocusedInput.value = char;
    // Trigger input event to handle auto-focus logic
    const event = new Event("input", { bubbles: true });
    lastFocusedInput.dispatchEvent(event);
    lastFocusedInput.focus(); // Keep focus
  } else {
    const msgArea = document.getElementById("message-area");
    msgArea.textContent = "请先点击选中一个填空格子";
    msgArea.style.color = "var(--primary-color)";
  }
}

// Update UI based on current mode
function updateModeUI() {
  const pool = document.getElementById("selection-pool");
  const inputs = document.querySelectorAll(".char-input");
  const positionSelect = document.getElementById("pool-position-select");

  if (currentMode === "select" || currentMode === "select_confused") {
    document.body.classList.remove("mode-handwriting");
    document.body.classList.add("pool-visible");
    document.getElementById("handwriting-container").classList.add("hidden");
    pool.classList.remove("hidden");
    if (positionSelect) positionSelect.style.display = "inline-block";
    inputs.forEach((input) => {
      input.setAttribute("readonly", "true");
    });
    generateSelectionPool();
    // Layout will be adjusted in generateSelectionPool -> adjustLayout
  } else if (currentMode === "handwriting") {
    document.body.classList.add("mode-handwriting");
    document.body.classList.remove("pool-visible");
    pool.classList.add("hidden");
    if (positionSelect) positionSelect.style.display = "none";
    inputs.forEach((input) => {
      input.setAttribute("readonly", "true"); // Prevent typing, force click to open HW board
    });
    // ... (rest of handwriting logic) ...

    // Automatically focus the first available input to activate handwriting board
    let targetInput = null;
    if (lastFocusedInput && Array.from(inputs).includes(lastFocusedInput)) {
      targetInput = lastFocusedInput;
    } else {
      // Find first empty
      const empty = Array.from(inputs).find((input) => !input.value);
      targetInput = empty || inputs[0];
    }

    if (targetInput) {
      targetInput.focus();
    } else {
      document.getElementById("handwriting-container").classList.add("hidden");
    }
  } else if (currentMode === "sort") {
    // Sort Mode UI
    document.body.classList.remove("mode-handwriting");
    document.body.classList.remove("pool-visible");
    document.getElementById("handwriting-container").classList.add("hidden");
    pool.classList.add("hidden");
    if (positionSelect) positionSelect.style.display = "none";
    // Inputs are not used in sort mode (divs are used), but if any exist, disable them
    inputs.forEach((input) => input.setAttribute("disabled", "true"));
  } else {
    // Input Mode
    document.body.classList.remove("mode-handwriting");
    document.body.classList.remove("pool-visible");
    document.getElementById("handwriting-container").classList.add("hidden");
    pool.classList.add("hidden");
    if (positionSelect) positionSelect.style.display = "none";
    inputs.forEach((input) => {
      input.removeAttribute("readonly");
      input.removeAttribute("disabled");
    });
  }

  updateStrokeBtnVisibility();
}

// Generate selection pool for select mode
function generateSelectionPool() {
  const pool = document.getElementById("selection-pool");
  pool.innerHTML = "";

  if (blanks.length === 0) return;

  // Get all correct characters from blanks
  let chars = blanks.map((b) => b.correctChar);

  // If in Confused Mode, add distractors
  if (currentMode === "select_confused") {
    const distractorCount = Math.max(1, Math.floor(chars.length * 0.5));
    const distractors = generateDistractors(chars, distractorCount);
    chars = chars.concat(distractors);
  }

  // Shuffle logic
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  chars.forEach((char) => {
    const btn = document.createElement("div");
    btn.className = "pool-char";
    btn.textContent = char;
    btn.addEventListener("click", () => handlePoolSelection(char));
    pool.appendChild(btn);
  });

  blanks.forEach((blank) => {
    if (blank.element.value) {
      togglePoolChar(blank.element.value, true);
    }
  });

  // Wait for DOM update then adjust layout
  requestAnimationFrame(() => {
    adjustLayout();
  });
}

function adjustLayout() {
  const body = document.body;
  const pool = document.getElementById("selection-pool");
  const container = document.querySelector(".container");

  if (!pool || !container) return;

  // Reset styles first
  container.style.marginLeft = "";
  container.style.marginRight = "";

  // Check if pool is visible
  if (
    pool.classList.contains("hidden") ||
    getComputedStyle(pool).display === "none"
  ) {
    // Reset pool height var when hidden
    document.documentElement.style.setProperty("--pool-height", "0px");
    return;
  }

  // Calculate pool height including borders/padding
  const height = pool.offsetHeight;
  document.documentElement.style.setProperty("--pool-height", height + "px");

  if (body.classList.contains("pool-left")) {
    const width = pool.offsetWidth;
    // Add a little buffer if needed, but offsetWidth includes padding/border
    container.style.marginLeft = `${width}px`;
  } else if (body.classList.contains("pool-right")) {
    const width = pool.offsetWidth;
    container.style.marginRight = `${width}px`;
  }
}

function togglePoolChar(char, isUsed) {
  const pool = document.getElementById("selection-pool");
  if (!pool) return;

  const buttons = Array.from(pool.getElementsByClassName("pool-char"));

  if (isUsed) {
    // Find an available button with this char and mark it used
    const btn = buttons.find(
      (b) => b.textContent === char && !b.classList.contains("used"),
    );
    if (btn) {
      btn.classList.add("used");
    }
  } else {
    // Find a used button with this char and mark it available
    // We prioritize marking one available that is 'used'
    const btn = buttons.find(
      (b) => b.textContent === char && b.classList.contains("used"),
    );
    if (btn) {
      btn.classList.remove("used");
    }
  }
}

function generateDistractors(correctChars, count) {
  const distractors = [];

  // 1. Try to find specific confused chars first
  correctChars.forEach((char) => {
    if (distractors.length < count) {
      const confused = getConfusedChar(char);
      if (
        confused &&
        !correctChars.includes(confused) &&
        !distractors.includes(confused)
      ) {
        distractors.push(confused);
      }
    }
  });

  // 2. Fill remaining with random chars from other poems
  while (distractors.length < count) {
    const randomChar = getRandomCharFromPoems();
    if (
      randomChar &&
      !correctChars.includes(randomChar) &&
      !distractors.includes(randomChar)
    ) {
      distractors.push(randomChar);
    }
  }

  return distractors;
}

// Global confusedMap loaded from confused_chars.js
let confusedMap = {};

if (typeof confusedMapData !== "undefined") {
  confusedMap = confusedMapData;
} else {
  console.warn(
    "confusedMapData is not defined. Confused selection mode might not work optimally.",
  );
}

function getConfusedChar(char) {
  if (confusedMap[char]) {
    // Return a random one from the list
    const list = confusedMap[char];
    return list[Math.floor(Math.random() * list.length)];
  }
  return null;
}

function getRandomCharFromPoems() {
  if (!poems || poems.length === 0) return "中";

  // Pick a random poem
  const randomPoem = poems[Math.floor(Math.random() * poems.length)];
  if (!randomPoem || !randomPoem.content) return "中";

  // Pick a random line
  const randomLine =
    randomPoem.content[Math.floor(Math.random() * randomPoem.content.length)];
  if (!randomLine) return "中";

  // Pick a random char
  const char = randomLine[Math.floor(Math.random() * randomLine.length)];

  if (isChineseChar(char)) return char;
  return getRandomCharFromPoems(); // Try again if not chinese char (unlikely but safe)
}

// Handle selection from pool
function handlePoolSelection(char) {
  // Check if this char is available in pool (though UI should prevent click, logic check is safe)
  // But since we pass 'char' string, we rely on togglePoolChar to find *an* instance.
  // We should strictly check if there is an unused instance available?
  // Since the click event comes from a button, maybe we should check the button state?
  // But here we just get the char string.
  // Let's assume the button click handler prevents calling this if used, OR we check here.

  // Actually, we should handle the 'used' check in the button click handler in generateSelectionPool?
  // Or just rely on CSS pointer-events: none.
  // CSS pointer-events: none is sufficient for blocking clicks.

  playSound("select");

  // If no input is focused, try to find the first empty one
  if (!lastFocusedInput) {
    const emptyBlank = blanks.find((b) => !b.element.value);
    if (emptyBlank) {
      lastFocusedInput = emptyBlank.element;
      lastFocusedInput.focus();
    } else if (blanks.length > 0) {
      // If all full, default to first
      lastFocusedInput = blanks[0].element;
      lastFocusedInput.focus();
    }
  }

  if (lastFocusedInput) {
    // If input already has a value, return it to pool
    if (lastFocusedInput.value) {
      togglePoolChar(lastFocusedInput.value, false);
    }

    lastFocusedInput.value = char;
    togglePoolChar(char, true); // Mark new char as used

    lastFocusedInput.classList.remove("incorrect");
    lastFocusedInput.classList.remove("correct");

    // Auto jump to next
    focusNextInput(lastFocusedInput);
  }
}

// Start a new round
function startNewGame() {
  if (poems.length === 0) return;

  // Calculate safe history limit based on total poems
  // We need at least 1 poem available to pick
  const historyLimit = Math.min(
    MAX_RECENT_HISTORY,
    Math.max(0, poems.length - 1),
  );

  let availableIndices = [];
  for (let i = 0; i < poems.length; i++) {
    if (!recentPoemIndices.includes(i)) {
      availableIndices.push(i);
    }
  }

  // Fallback: If for some reason no indices available (shouldn't happen with correct limit logic),
  // reset history or pick from all.
  if (availableIndices.length === 0) {
    // Determine if we should clear history or just pick any.
    // If poems.length <= 1, we can't do anything.
    if (poems.length <= 1) {
      availableIndices = [0];
    } else {
      // This case implies history is full of all poems?
      // Just reset history to allow re-picking oldest ones
      // Or better: keep the most recent ones and allow picking from the oldest ones that were just evicted
      // But simply: if no available, reset history
      recentPoemIndices = [];
      for (let i = 0; i < poems.length; i++) availableIndices.push(i);
    }
  }

  // Pick random from available
  const randomAvailableIndex = Math.floor(
    Math.random() * availableIndices.length,
  );
  const selectedPoemIndex = availableIndices[randomAvailableIndex];

  currentPoem = poems[selectedPoemIndex];

  // Update history
  recentPoemIndices.push(selectedPoemIndex);
  if (recentPoemIndices.length > historyLimit) {
    recentPoemIndices.shift();
  }

  renderPoem();
  document.getElementById("message-area").textContent = "";
  document.getElementById("message-area").className = "";

  lastFocusedInput = null;
}

function startSpecificGame(index) {
  if (index < 0 || index >= poems.length) return;

  currentPoem = poems[index];

  // We don't necessarily need to add manual selection to recent history for deduplication purposes,
  // as deduplication is for "random" mode.
  // However, if we want to avoid "Next Poem" picking this one immediately again, we should add it.
  // Let's add it.

  // Remove if already in history (to move to end)
  const historyIndex = recentPoemIndices.indexOf(index);
  if (historyIndex > -1) {
    recentPoemIndices.splice(historyIndex, 1);
  }

  recentPoemIndices.push(index);
  const historyLimit = Math.min(
    MAX_RECENT_HISTORY,
    Math.max(0, poems.length - 1),
  );
  if (recentPoemIndices.length > historyLimit) {
    recentPoemIndices.shift();
  }

  renderPoem();
  document.getElementById("message-area").textContent = "";
  document.getElementById("message-area").className = "";
  lastFocusedInput = null;
}

function openPoemPicker() {
  const modal = document.getElementById("poem-picker-modal");
  if (!modal) return;

  // Clear search input
  const searchInput = document.getElementById("poem-search");
  if (searchInput) searchInput.value = "";

  // Render full list
  renderPoemList();

  modal.classList.remove("hidden");
}

function renderPoemList(filterText = "") {
  const list = document.getElementById("poem-list");
  if (!list) return;

  list.innerHTML = ""; // Clear existing

  const lowerFilter = filterText.toLowerCase();

  poems.forEach((poem, index) => {
    // Filter based on title or author
    if (filterText) {
      const matchTitle = poem.title.toLowerCase().includes(lowerFilter);
      const matchAuthor = poem.author.toLowerCase().includes(lowerFilter);
      if (!matchTitle && !matchAuthor) return;
    }

    const item = document.createElement("div");
    item.className = "poem-item";
    item.onclick = () => {
      startSpecificGame(index);
      closePoemPicker();
    };

    const titleSpan = document.createElement("span");
    titleSpan.className = "poem-item-title";
    titleSpan.textContent = poem.title;

    const authorSpan = document.createElement("span");
    authorSpan.className = "poem-item-author";
    authorSpan.textContent = `[${poem.dynasty}] ${poem.author}`;

    item.appendChild(titleSpan);
    item.appendChild(authorSpan);
    list.appendChild(item);
  });
}

function closePoemPicker() {
  const modal = document.getElementById("poem-picker-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

function restartCurrentGame() {
  if (currentMode === "sort") {
    renderPoem();
    document.getElementById("message-area").textContent = "";
    return;
  }

  if (blanks.length === 0) return;

  // Clear all inputs
  blanks.forEach((b) => {
    b.element.value = "";
    b.element.classList.remove("correct", "incorrect");
  });

  // Reset pool chars
  const pool = document.getElementById("selection-pool");
  if (pool) {
    const buttons = pool.querySelectorAll(".pool-char");
    buttons.forEach((btn) => btn.classList.remove("used"));
  }

  // Clear message area
  const msgArea = document.getElementById("message-area");
  msgArea.textContent = "";
  msgArea.className = "";

  // Reset focus to first input
  lastFocusedInput = null;
  if (blanks.length > 0) {
    blanks[0].element.focus();
  }
}

function showStrokeOrder(char) {
  const display = document.getElementById("stroke-text-display");
  if (!display) return;

  // Toggle visibility if already showing the same character?
  // For now, let's just show it. If user wants to hide, maybe clicking again?
  // Let's assume click means "show".

  display.innerHTML = "";
  display.classList.remove("hidden");
  display.style.display = "block";

  // Ensure single character
  const targetChar = char.charAt(0);
  if (!isChineseChar(targetChar)) {
    display.textContent = "非汉字无法显示笔顺";
    return;
  }

  display.textContent = "正在加载...";

  requestAnimationFrame(() => {
    display.innerHTML = "";

    // Create Layout
    const animContainer = document.createElement("div");
    animContainer.id = "hanzi-anim-target";
    animContainer.className = "hanzi-anim-target";
    // Center the animation
    animContainer.style.margin = "0 auto 15px auto";
    animContainer.style.width = "200px"; // Fixed size for consistency
    animContainer.style.height = "200px";
    animContainer.style.border = "1px solid #ddd";
    animContainer.style.borderRadius = "4px";
    animContainer.style.backgroundColor = "#fff";

    display.appendChild(animContainer);

    const textContainer = document.createElement("div");
    textContainer.className = "stroke-text-list";
    display.appendChild(textContainer);

    // 1. HanziWriter Animation
    if (typeof HanziWriter !== "undefined") {
      try {
        const writer = HanziWriter.create("hanzi-anim-target", targetChar, {
          width: 200,
          height: 200,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 200,
          strokeColor: "#333",
          radicalColor: "#168F16",
          onLoadCharDataError: function (reason) {
            console.error("HanziWriter load error:", reason);
            animContainer.textContent = "动画加载失败";
          },
        });
        writer.loopCharacterAnimation();
      } catch (e) {
        console.error("HanziWriter init error:", e);
        animContainer.textContent = "动画初始化失败";
      }
    } else {
      animContainer.textContent = "动画库加载失败";
    }

    // 2. Text Description (cnchar)
    if (typeof cnchar !== "undefined" && cnchar.stroke) {
      try {
        // Get stroke names: ['横', '竖', ...]
        const strokeNames = cnchar.stroke(targetChar, "order", "name");
        if (Array.isArray(strokeNames) && strokeNames.length > 0) {
          let textHtml = `<div class="stroke-title">【${targetChar}】的笔顺：</div>`;
          textHtml += '<div class="stroke-list">';
          textHtml += strokeNames
            .map((name, index) => {
              return `<div class="stroke-step">${index + 1}. ${name}</div>`;
            })
            .join("");
          textHtml += "</div>";
          textContainer.innerHTML = textHtml;
        } else {
          textContainer.textContent = "暂无笔顺文字数据";
        }
      } catch (e) {
        console.error("cnchar text error:", e);
        textContainer.textContent = "加载文字说明失败";
      }
    }
  });
}

function showPinyin(char) {
  const display = document.getElementById("stroke-text-display");
  if (!display) return;

  display.classList.remove("hidden");
  display.style.display = "block";
  display.innerHTML = "正在加载...";

  requestAnimationFrame(() => {
    display.innerHTML = "";

    const container = document.createElement("div");
    container.className = "pinyin-def-container";
    container.style.padding = "10px";
    container.style.textAlign = "center";
    container.style.backgroundColor = "#fff";
    container.style.borderRadius = "5px";
    container.style.border = "1px solid #ddd";

    // Large Char
    const charDiv = document.createElement("div");
    charDiv.style.fontSize = "4em";
    charDiv.style.textAlign = "center";
    charDiv.style.marginBottom = "10px";
    charDiv.style.color = "var(--primary-color)";
    charDiv.textContent = char;
    container.appendChild(charDiv);

    // Pinyin
    const pinyinDiv = document.createElement("div");
    pinyinDiv.style.fontSize = "2em";
    pinyinDiv.style.marginBottom = "8px";
    let pinyin = "";
    if (typeof cnchar !== "undefined" && cnchar.spell) {
      pinyin = cnchar.spell(char, "tone");
    }
    pinyinDiv.innerHTML = `${pinyin || "未知"}`;
    container.appendChild(pinyinDiv);

    // Note: Explanation feature removed due to CDN issues on GitHub Pages

    display.appendChild(container);
  });
}

function updateStrokeBtnVisibility() {
  const btn = document.getElementById("hw-stroke-btn");
  const pinyinBtn = document.getElementById("hw-pinyin-btn");
  const display = document.getElementById("stroke-text-display");

  const isValid =
    currentMode === "handwriting" && lastFocusedInput && lastFocusedInput.value;

  if (btn) {
    if (isValid) {
      btn.classList.remove("hidden");
      btn.style.display = "inline-block";
    } else {
      btn.classList.add("hidden");
      btn.style.display = "none";
    }
  }

  if (pinyinBtn) {
    if (isValid) {
      pinyinBtn.classList.remove("hidden");
      pinyinBtn.style.display = "inline-block";
    } else {
      pinyinBtn.classList.add("hidden");
      pinyinBtn.style.display = "none";
    }
  }

  // Always hide the display when state updates.
  // User must click the button again to show it for the current state.
  if (display && !display.classList.contains("hidden")) {
    display.classList.add("hidden");
    display.style.display = "none";
    display.innerHTML = "";
  }
}

// Shuffle array utility
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

let dragSrcEl = null;
let selectedSortChar = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/html", this.innerHTML);
  this.classList.add("dragging");
  if (selectedSortChar) {
    selectedSortChar.classList.remove("selected");
    selectedSortChar = null;
  }
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = "move";

  const target = e.target;

  // Basic checks: target must be a different sort-char in the same container
  if (
    target === dragSrcEl ||
    !target.classList.contains("sort-char") ||
    target.parentNode !== dragSrcEl.parentNode
  ) {
    return false;
  }

  const container = dragSrcEl.parentNode;
  const rect = target.getBoundingClientRect();
  // Determine if we are hovering the right half of the target
  const next = (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;

  // Check if move is needed to avoid redundant operations
  if (next) {
    // Should be after target
    if (dragSrcEl.previousElementSibling === target) return false;
  } else {
    // Should be before target
    if (dragSrcEl.nextElementSibling === target) return false;
  }

  // --- FLIP Animation Start ---
  const siblings = [...container.children];
  const positions = new Map();
  siblings.forEach((el) => positions.set(el, el.getBoundingClientRect()));

  // Perform DOM Move
  if (next) {
    container.insertBefore(dragSrcEl, target.nextSibling);
  } else {
    container.insertBefore(dragSrcEl, target);
  }

  // --- FLIP Animation Play ---
  // Get new positions
  const newSiblings = [...container.children];
  newSiblings.forEach((el) => {
    // We don't animate the dragged element itself as it's following the mouse (ghost)
    // or staying semi-transparent in its new slot
    if (el === dragSrcEl) return;

    const oldRect = positions.get(el);
    const newRect = el.getBoundingClientRect();

    if (oldRect) {
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (dx !== 0 || dy !== 0) {
        // Invert
        el.classList.add("no-transition");
        el.style.transform = `translate(${dx}px, ${dy}px)`;

        // Force reflow
        el.offsetHeight;

        // Play
        requestAnimationFrame(() => {
          el.classList.remove("no-transition");
          el.style.transform = "";
        });
      }
    }
  });

  return false;
}

function handleDragEnter(e) {
  if (e.target !== dragSrcEl && e.target.classList.contains("sort-char")) {
    e.target.classList.add("over");
  }
}

function handleDragLeave(e) {
  e.target.classList.remove("over");
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  // DOM reordering already happened in DragOver
  // Just clear validation status as positions changed
  if (dragSrcEl && dragSrcEl.parentNode) {
    const chars = dragSrcEl.parentNode.querySelectorAll(".sort-char");
    chars.forEach((char) => char.classList.remove("correct", "incorrect"));
  }

  playSound("select");
  return false;
}

function handleDragEnd(e) {
  this.classList.remove("dragging");
  const items = document.querySelectorAll(".sort-char");
  items.forEach((item) => {
    item.classList.remove("over");
    item.style.transform = ""; // Cleanup any stuck transforms
  });
}

function handleSortClick(e) {
  if (currentMode !== "sort") return;

  const target = e.target;
  if (!target.classList.contains("sort-char")) return;

  playSound("select");

  if (selectedSortChar === null) {
    // Select first char
    selectedSortChar = target;
    target.classList.add("selected");
  } else if (selectedSortChar === target) {
    // Deselect if same
    selectedSortChar.classList.remove("selected");
    selectedSortChar = null;
  } else {
    // Swap
    // Check if same line
    if (selectedSortChar.parentNode === target.parentNode) {
      const temp = selectedSortChar.textContent;
      selectedSortChar.textContent = target.textContent;
      target.textContent = temp;

      selectedSortChar.classList.remove("selected");
      selectedSortChar.classList.remove("correct", "incorrect");
      target.classList.remove("correct", "incorrect");
      selectedSortChar = null;
    } else {
      // Different line, just change selection
      selectedSortChar.classList.remove("selected");
      selectedSortChar = target;
      target.classList.add("selected");
    }
  }
}

// Render the poem based on difficulty
function renderPoem() {
  const titleEl = document.getElementById("poem-title");
  const authorEl = document.getElementById("poem-author");
  const contentEl = document.getElementById("poem-content");

  titleEl.textContent = currentPoem.title;
  authorEl.textContent = `[${currentPoem.dynasty}] ${currentPoem.author}`;
  contentEl.innerHTML = "";
  blanks = [];

  currentPoem.content.forEach((line, lineIndex) => {
    const lineEl = document.createElement("div");
    lineEl.className = "poem-line";

    if (currentMode === "sort") {
      // Sort Mode Logic
      const chars = line.split("");
      let finalChars = [...chars];

      // Determine shuffle ratio based on difficulty
      let shuffleRatio = 1.0;
      if (currentDifficulty === "easy") shuffleRatio = 0.3;
      else if (currentDifficulty === "medium") shuffleRatio = 0.6;

      const countToShuffle = Math.max(
        2,
        Math.ceil(chars.length * shuffleRatio),
      );

      if (shuffleRatio === 1.0 || countToShuffle >= chars.length) {
        finalChars = shuffleArray([...chars]);
      } else {
        // Partial shuffle logic
        const allIndices = Array.from({ length: chars.length }, (_, i) => i);
        // Shuffle indices to pick random ones
        for (let i = allIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
        }
        const indicesToShuffle = allIndices.slice(0, countToShuffle);

        // Extract values
        const valuesToShuffle = indicesToShuffle.map((i) => chars[i]);

        // Shuffle values
        const shuffledValues = shuffleArray(valuesToShuffle);

        // Put back
        indicesToShuffle.forEach((index, i) => {
          finalChars[index] = shuffledValues[i];
        });
      }

      finalChars.forEach((char) => {
        const charEl = document.createElement("div");
        charEl.className = "sort-char";
        charEl.textContent = char;
        charEl.draggable = true;

        // Add DnD listeners
        charEl.addEventListener("dragstart", handleDragStart);
        charEl.addEventListener("dragenter", handleDragEnter);
        charEl.addEventListener("dragover", handleDragOver);
        charEl.addEventListener("dragleave", handleDragLeave);
        charEl.addEventListener("drop", handleDrop);
        charEl.addEventListener("dragend", handleDragEnd);

        // Add touch support (basic tap to swap logic could be added here too)
        charEl.addEventListener("click", handleSortClick);

        lineEl.appendChild(charEl);
      });
    } else {
      // Standard Modes Logic
      const chars = line.split("");
      const blankIndices = determineBlanks(chars.length, currentDifficulty);

      chars.forEach((char, charIndex) => {
        if (blankIndices.includes(charIndex) && isChineseChar(char)) {
          // Create input for blank
          const input = document.createElement("input");
          input.type = "text";
          input.className = "char-input";
          // input.maxLength = 1; // Removed to allow IME composition
          input.dataset.line = lineIndex;
          input.dataset.char = charIndex;

          // Add event listener for auto-focus next
          input.addEventListener("compositionstart", () => {
            input.dataset.isComposing = "true";
          });
          input.addEventListener("compositionend", () => {
            input.dataset.isComposing = "false";
            // If multiple chars entered (e.g. from IME), keep only the last one or valid one
            // Usually user wants the last entered character if they are replacing,
            // but here we are filling blanks.
            // Let's just take the last character if length > 1
            if (input.value.length > 1) {
              // If user typed a full sentence, maybe we should handle that?
              // But for now let's just keep the last char to be safe and simple
              input.value = input.value.slice(-1);
            }

            if (input.value.length >= 1) {
              focusNextInput(input);
            }
          });
          input.addEventListener("input", (e) => {
            handleInput(e, input);
            // Only update tracing char if this input is still focused
            if (document.activeElement === input) {
              setTracingChar(input.value);
              updateStrokeBtnVisibility();
            }
          });
          input.addEventListener("keydown", (e) => handleKeydown(e, input));

          // Track focus
          input.addEventListener("focus", (e) => {
            // Remove active class from others
            document
              .querySelectorAll(".char-input")
              .forEach((el) => el.classList.remove("active-focus"));
            input.classList.add("active-focus");
            lastFocusedInput = input;
            setTracingChar(input.value);
            updateStrokeBtnVisibility();

            // If in handwriting mode, show the board
            if (currentMode === "handwriting") {
              showHandwritingBoard();
            }
          });

          lineEl.appendChild(input);

          blanks.push({
            lineIndex,
            charIndex,
            correctChar: char,
            element: input,
          });
        } else {
          // Show character
          const span = document.createElement("div");
          span.className = "char-box";
          span.textContent = char;
          lineEl.appendChild(span);
        }
      });
    }

    contentEl.appendChild(lineEl);
  });

  // Focus first input
  if (blanks.length > 0) {
    // Small timeout to ensure DOM is ready
    setTimeout(() => {
      blanks[0].element.focus();
    }, 100);
  }

  updateModeUI();

  // Re-enable check button
  const checkBtn = document.getElementById("check-btn");
  if (checkBtn) checkBtn.disabled = false;
}

// Determine which characters to hide based on difficulty
function determineBlanks(length, difficulty) {
  let indices = [];
  const allIndices = Array.from({ length }, (_, i) => i);

  // Filter out punctuation if needed, but for now assuming we only hide valid chars.
  // However, the rendering logic checks isChineseChar, so here we just pick indices.

  let count = 0;
  if (difficulty === "easy") {
    // Hide ~25-30% or at least 1
    count = Math.max(1, Math.floor(length * 0.3));
  } else if (difficulty === "medium") {
    // Hide ~50%
    count = Math.max(2, Math.floor(length * 0.5));
  } else {
    // Hard: Hide ~70-80%
    count = Math.max(length - 1, Math.floor(length * 0.8));
  }

  // Shuffle and pick
  for (let i = allIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
  }

  return allIndices.slice(0, count);
}

function isChineseChar(char) {
  return /[\u4e00-\u9fa5]/.test(char);
}

// Handle input for auto-focusing
function handleInput(e, input) {
  if (input.dataset.isComposing === "true") return;
  if (e.target.value.length >= 1) {
    focusNextInput(input);
  }
}

function handleKeydown(e, input) {
  const isReadOnlyMode =
    currentMode === "select" ||
    currentMode === "select_confused" ||
    currentMode === "handwriting";

  if (e.key === "Delete") {
    playSound("select");
    if (isReadOnlyMode) {
      e.preventDefault();
      // Free the char back to pool
      if (input.value) {
        togglePoolChar(input.value, false);
      }
      input.value = "";
      input.classList.remove("correct", "incorrect");
      setTracingChar("");
      updateStrokeBtnVisibility();
    }
    return;
  }

  if (e.key === "Backspace") {
    playSound("select");
    if (isReadOnlyMode) {
      e.preventDefault(); // Prevent browser back navigation
      if (input.value !== "") {
        // If current input has content, clear it and free char
        togglePoolChar(input.value, false);
        input.value = "";
        input.classList.remove("correct", "incorrect");
        setTracingChar("");
        updateStrokeBtnVisibility();
      } else {
        // If current is empty, move to previous and clear it
        const inputs = Array.from(document.querySelectorAll(".char-input"));
        const index = inputs.indexOf(input);
        if (index > 0) {
          const prevInput = inputs[index - 1];
          prevInput.focus();
          // Free char from prev input
          if (prevInput.value) {
            togglePoolChar(prevInput.value, false);
          }
          prevInput.value = "";
          prevInput.classList.remove("correct", "incorrect");
          setTracingChar("");
          updateStrokeBtnVisibility();
        }
      }
    } else {
      // Input mode
      if (input.value === "") {
        focusPrevInput(input);
      }
    }
  }
}

function focusNextInput(currentInput) {
  const inputs = Array.from(document.querySelectorAll(".char-input"));
  const index = inputs.indexOf(currentInput);
  if (index > -1 && index < inputs.length - 1) {
    inputs[index + 1].focus();
  }
}

function focusPrevInput(currentInput) {
  const inputs = Array.from(document.querySelectorAll(".char-input"));
  const index = inputs.indexOf(currentInput);
  if (index > 0) {
    inputs[index - 1].focus();
  }
}

function checkSortAnswers() {
  let allCorrect = true;
  const lines = document.querySelectorAll(".poem-line");

  lines.forEach((line, lineIndex) => {
    const chars = line.querySelectorAll(".sort-char");
    const correctLine = currentPoem.content[lineIndex];

    chars.forEach((charEl, charIndex) => {
      const val = charEl.textContent.trim();
      const correctVal = correctLine[charIndex];

      if (val === correctVal) {
        charEl.classList.add("correct");
        charEl.classList.remove("incorrect");
      } else {
        charEl.classList.add("incorrect");
        charEl.classList.remove("correct");
        allCorrect = false;
      }
    });
  });

  const msgArea = document.getElementById("message-area");
  const checkBtn = document.getElementById("check-btn");

  if (allCorrect) {
    if (checkBtn) checkBtn.disabled = true;
    msgArea.textContent = "恭喜你！全部答对了！";
    msgArea.style.color = "var(--success-color)";
    playSound("success");
    if (typeof confetti === "function") {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    setTimeout(() => {
      msgArea.textContent = "即将开始下一首...";
      setTimeout(() => startNewGame(), 1000);
    }, 3000);
  } else {
    playSound("error");
    msgArea.textContent = "位置不对哦，请调整顺序！";
    msgArea.style.color = "var(--error-color)";
  }
}

// Check answers
function checkAnswers() {
  if (currentMode === "sort") {
    checkSortAnswers();
    return;
  }
  let allCorrect = true;
  let filledCount = 0;

  blanks.forEach((blank) => {
    const val = blank.element.value.trim();
    if (val) filledCount++;

    if (val === blank.correctChar) {
      blank.element.classList.add("correct");
      blank.element.classList.remove("incorrect");
    } else {
      if (val !== "") {
        blank.element.classList.add("incorrect");
      }
      blank.element.classList.remove("correct");
      allCorrect = false;
    }
  });

  const msgArea = document.getElementById("message-area");
  const checkBtn = document.getElementById("check-btn");

  if (allCorrect) {
    if (checkBtn) checkBtn.disabled = true; // Disable button to prevent multiple clicks

    msgArea.textContent = "恭喜你！全部答对了！";
    msgArea.style.color = "var(--success-color)";

    // Play success sound
    playSound("success");

    // Trigger confetti
    if (typeof confetti === "function") {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    // Auto-start new game after delay
    setTimeout(() => {
      msgArea.textContent = "即将开始下一首...";
      setTimeout(() => {
        startNewGame();
      }, 1000);
    }, 3000); // 3 seconds delay for confetti
  } else {
    // Play error sound
    playSound("error");

    if (filledCount < blanks.length) {
      msgArea.textContent = "还有没填完的空哦，继续加油！";
    } else {
      const randomMsg =
        encouragingMessages[
          Math.floor(Math.random() * encouragingMessages.length)
        ];
      msgArea.textContent = `有错误，请检查红色标记的地方。${randomMsg}`;
    }
    msgArea.style.color = "var(--error-color)";
  }
}

// Show hint (one character)
function showCharHint() {
  const msgArea = document.getElementById("message-area");

  if (currentMode === "sort") {
    msgArea.textContent = "排序模式请使用整句提示功能";
    msgArea.style.color = "var(--primary-color)";
    return;
  }

  if (!lastFocusedInput) {
    msgArea.textContent = "请先点击选中一个需要提示的填空格子";
    msgArea.style.color = "var(--primary-color)";
    return;
  }

  // Find the blank object corresponding to the input
  const blank = blanks.find((b) => b.element === lastFocusedInput);

  if (blank) {
    if (blank.element.value === blank.correctChar) {
      msgArea.textContent = "这个字已经是正确的啦！";
      msgArea.style.color = "var(--success-color)";
    } else {
      blank.element.value = blank.correctChar;
      blank.element.classList.add("correct");
      blank.element.classList.remove("incorrect");
      msgArea.textContent = "";

      // Play success sound for feedback
      playSound("success");

      blank.element.focus();
      updateStrokeBtnVisibility();
    }
  }
}

// Show hint (one sentence)
function showHint() {
  if (currentMode === "sort") {
    // Find first incorrect line
    const lines = document.querySelectorAll(".poem-line");
    let targetLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const chars = lines[i].querySelectorAll(".sort-char");
      const correctLine = currentPoem.content[i];
      let lineCorrect = true;
      for (let j = 0; j < chars.length; j++) {
        if (chars[j].textContent !== correctLine[j]) {
          lineCorrect = false;
          break;
        }
      }
      if (!lineCorrect) {
        targetLineIndex = i;
        break;
      }
    }

    if (targetLineIndex !== -1) {
      const line = lines[targetLineIndex];
      const correctLine = currentPoem.content[targetLineIndex];
      const chars = line.querySelectorAll(".sort-char");

      chars.forEach((charEl, index) => {
        charEl.textContent = correctLine[index];
        charEl.classList.add("correct");
        charEl.classList.remove("incorrect");
      });

      const msgArea = document.getElementById("message-area");
      msgArea.textContent = `已还原第 ${parseInt(targetLineIndex) + 1} 句`;
      msgArea.style.color = "var(--primary-color)";
      playSound("success");
    } else {
      document.getElementById("message-area").textContent =
        "你已经全部排好了！";
    }
    return;
  }

  // Find the first line that has unfilled or incorrect blanks
  // User requested "one sentence hint".
  // We will group blanks by line.

  // Sort blanks by lineIndex then charIndex just in case
  // (Already pushed in order, but good to be safe if we randomize later)

  const blanksByLine = {};
  blanks.forEach((blank) => {
    if (!blanksByLine[blank.lineIndex]) {
      blanksByLine[blank.lineIndex] = [];
    }
    blanksByLine[blank.lineIndex].push(blank);
  });

  // Find a line that needs help
  let targetLineIndex = -1;

  // First, look for lines with errors
  for (const lineIdx in blanksByLine) {
    const lineBlanks = blanksByLine[lineIdx];
    const hasError = lineBlanks.some(
      (b) => b.element.value && b.element.value !== b.correctChar,
    );
    const hasEmpty = lineBlanks.some((b) => !b.element.value);

    if (hasError || hasEmpty) {
      targetLineIndex = lineIdx;
      break;
    }
  }

  if (targetLineIndex !== -1) {
    const lineBlanks = blanksByLine[targetLineIndex];
    let revealedSomething = false;

    // Reveal the whole sentence? "provide hint function, but only one sentence at a time"
    // Let's interpret this as "Show the user the correct content for this sentence in a message"
    // OR "Fill in the blanks for this sentence".
    // Filling in blanks is more direct.

    lineBlanks.forEach((blank) => {
      if (blank.element.value !== blank.correctChar) {
        blank.element.value = blank.correctChar;
        blank.element.classList.add("correct");
        blank.element.classList.remove("incorrect");
        revealedSomething = true;
      }
    });

    const msgArea = document.getElementById("message-area");
    if (revealedSomething) {
      msgArea.textContent = `已提示第 ${parseInt(targetLineIndex) + 1} 句`;
      msgArea.style.color = "var(--primary-color)";
    } else {
      msgArea.textContent = "这句已经填对了！";
    }
  } else {
    document.getElementById("message-area").textContent = "你已经全部填对了！";
  }
}

// Sound effects support
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  // Ensure context is running (browsers suspend it until user interaction)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  if (type === "success") {
    // Play a happy major chord (C-E-G-C)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const startTime = now + i * 0.1;
      osc.start(startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      osc.stop(startTime + 0.5);
    });
  } else if (type === "error") {
    // Play a sad "wobble" sound
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth"; // Use sawtooth for a buzzier, more audible "wrong" sound
    osc.frequency.setValueAtTime(300, now); // Higher starting pitch
    osc.frequency.linearRampToValueAtTime(150, now + 0.3); // Slide down

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    gain.gain.setValueAtTime(0.2, now); // Louder volume
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.stop(now + 0.3);
  } else if (type === "select") {
    // Crisp click/pop sound
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.stop(now + 0.15);
  }
}

const encouragingMessages = [
  "别气馁，再试一次！",
  "失败是成功之母，加油！",
  "再仔细看看，你一定行的！",
  "差一点点就对了，继续努力！",
  "相信自己，下次一定全对！",
  "多读几遍诗句，语感会告诉你答案！",
];

function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById("confirm-modal");
  const messageEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok-btn");
  const cancelBtn = document.getElementById("confirm-cancel-btn");
  const closeBtn = document.getElementById("close-confirm-modal");

  messageEl.textContent = message;
  modal.classList.remove("hidden");

  // Clone buttons to remove previous event listeners
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  newOkBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (onConfirm) onConfirm();
  });

  newCancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  newCloseBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  };
}

// Start
loadPoems();
