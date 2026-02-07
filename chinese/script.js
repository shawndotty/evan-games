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
      // Reset current poem inputs when switching modes
      const inputs = document.querySelectorAll(".char-input");
      inputs.forEach((input) => {
        input.value = "";
        input.classList.remove("correct", "incorrect");
      });
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
  document.getElementById("hint-btn").addEventListener("click", showHint);

  startNewGame();
}

function updatePoolPosition(position) {
  const body = document.body;
  // Remove all position classes
  body.classList.remove("pool-bottom", "pool-left", "pool-right");
  // Add new position class
  body.classList.add(`pool-${position}`);
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

  if (currentMode === "select") {
    pool.classList.remove("hidden");
    if (positionSelect) positionSelect.style.display = "inline-block";
    inputs.forEach((input) => {
      input.setAttribute("readonly", "true");
    });
    generateSelectionPool();
  } else {
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
  const chars = blanks.map((b) => b.correctChar);

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
    if (currentMode === "select") {
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
  } else {
    if (filledCount < blanks.length) {
      msgArea.textContent = "还有没填完的空哦，继续加油！";
    } else {
      msgArea.textContent = "有错误，请检查红色标记的地方。";
    }
    msgArea.style.color = "var(--error-color)";
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

// Start
loadPoems();
