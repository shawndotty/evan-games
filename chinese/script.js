let poems = [];
let currentPoem = null;
let currentMode = "input"; // "input" or "select"
let currentDifficulty = "medium";
let blanks = []; // Stores {lineIndex, charIndex, correctChar, inputElement}
let lastFocusedInput = null; // Track the last focused input for handwriting insertion
let handwritingCanvas = null; // Handwriting canvas instance

// Load poems from global variable (loaded via poems.js)
function loadPoems() {
  if (typeof poemsData !== "undefined") {
    poems = poemsData;
    initGame();
  } else {
    console.error("poemsData is not defined");
    document.getElementById("message-area").textContent =
      "加载诗词数据失败，请确保 poems.js 文件存在";
  }
}

// Initialize game state
function initGame() {
  const difficultySelect = document.getElementById("difficulty-select");
  if (difficultySelect) {
    difficultySelect.addEventListener("change", (e) => {
      currentDifficulty = e.target.value;
      startNewGame();
    });
  }

  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    modeSelect.addEventListener("change", (e) => {
      currentMode = e.target.value;
      updateModeUI();
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
  document.getElementById("check-btn").addEventListener("click", checkAnswers);
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
        lastFocusedInput.value = char;
        // Trigger input logic
        const event = new Event("input", { bubbles: true });
        lastFocusedInput.dispatchEvent(event);
        clearHandwriting();
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

    matcher.match(analyzedChar, 21, (matches) => {
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
    pool.classList.add("hidden");
    if (positionSelect) positionSelect.style.display = "none";
    inputs.forEach((input) => {
      input.setAttribute("readonly", "true"); // Prevent typing, force click to open HW board
    });
    // Ensure board is in correct initial state (dimmed/visible but inactive)
    // We rely on CSS handling .hidden class for dimming
    // But we might want to ensure it is 'hidden' initially until focused
    // document.getElementById("handwriting-container").classList.add("hidden");

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
  } else {
    document.body.classList.remove("mode-handwriting");
    document.getElementById("handwriting-container").classList.add("hidden");
    pool.classList.add("hidden");
    if (positionSelect) positionSelect.style.display = "none";
    inputs.forEach((input) => input.removeAttribute("readonly"));
  }
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
    return;
  }

  if (body.classList.contains("pool-left")) {
    const width = pool.offsetWidth;
    // Add a little buffer if needed, but offsetWidth includes padding/border
    container.style.marginLeft = `${width}px`;
  } else if (body.classList.contains("pool-right")) {
    const width = pool.offsetWidth;
    container.style.marginRight = `${width}px`;
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
    lastFocusedInput.value = char;
    lastFocusedInput.classList.remove("incorrect");
    lastFocusedInput.classList.remove("correct");

    // Auto jump to next
    focusNextInput(lastFocusedInput);
  }
}

// Start a new round
function startNewGame() {
  if (poems.length === 0) return;

  // Pick a random poem
  const randomIndex = Math.floor(Math.random() * poems.length);
  currentPoem = poems[randomIndex];

  renderPoem();
  document.getElementById("message-area").textContent = "";
  document.getElementById("message-area").className = "";

  lastFocusedInput = null;
}

// Restart current game (clear inputs)
function restartCurrentGame() {
  if (blanks.length === 0) return;

  // Clear all inputs
  blanks.forEach((b) => {
    b.element.value = "";
    b.element.classList.remove("correct", "incorrect");
  });

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
        input.addEventListener("input", (e) => handleInput(e, input));
        input.addEventListener("keydown", (e) => handleKeydown(e, input));

        // Track focus
        input.addEventListener("focus", (e) => {
          // Remove active class from others
          document
            .querySelectorAll(".char-input")
            .forEach((el) => el.classList.remove("active-focus"));
          input.classList.add("active-focus");
          lastFocusedInput = input;

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
  if (e.key === "Backspace") {
    if (currentMode === "select" || currentMode === "select_confused") {
      e.preventDefault(); // Prevent browser back navigation
      if (input.value !== "") {
        // If current input has content, clear it
        input.value = "";
        input.classList.remove("correct", "incorrect");
      } else {
        // If current is empty, move to previous and clear it
        const inputs = Array.from(document.querySelectorAll(".char-input"));
        const index = inputs.indexOf(input);
        if (index > 0) {
          const prevInput = inputs[index - 1];
          prevInput.focus();
          prevInput.value = "";
          prevInput.classList.remove("correct", "incorrect");
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

// Check answers
function checkAnswers() {
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
  if (allCorrect) {
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
    }
  }
}

// Show hint (one sentence)
function showHint() {
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

// Start
loadPoems();
