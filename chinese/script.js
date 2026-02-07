let poems = [];
let currentPoem = null;
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
  difficultySelect.addEventListener("change", (e) => {
    currentDifficulty = e.target.value;
    startNewGame();
  });

  document
    .getElementById("new-game-btn")
    .addEventListener("click", startNewGame);
  document.getElementById("check-btn").addEventListener("click", checkAnswers);
  document.getElementById("hint-btn").addEventListener("click", showHint);

  // Handwriting init
  initHandwriting();

  startNewGame();
}

function initHandwriting() {
  // Initialize HanziLookup (Offline Recognition)
  if (typeof HanziLookup !== "undefined" && typeof mmah_data !== "undefined") {
    try {
      HanziLookup.data = HanziLookup.data || {};
      HanziLookup.data["mmah"] = mmah_data;
      if (mmah_data.substrokes && typeof mmah_data.substrokes === "string") {
        HanziLookup.data["mmah"].substrokes = HanziLookup.decodeCompact(
          mmah_data.substrokes,
        );
      }

      // Override handwriting.recognize to use HanziLookup
      handwriting.recognize = function (trace, options, callback) {
        var strokes = [];
        for (var i = 0; i < trace.length; i++) {
          var stroke = trace[i]; // [x[], y[], time[]]
          var points = [];
          for (var j = 0; j < stroke[0].length; j++) {
            points.push([stroke[0][j], stroke[1][j]]);
          }
          strokes.push(points);
        }
        var analyzedChar = new HanziLookup.AnalyzedCharacter(strokes);
        var matcher = new HanziLookup.Matcher("mmah");
        matcher.match(analyzedChar, 10, function (matches) {
          var results = matches.map(function (m) {
            return m.character;
          });
          callback(results, undefined);
        });
      };
    } catch (e) {
      console.error("HanziLookup init error:", e);
    }
  }

  try {
    handwritingCanvas = new handwriting.Canvas(
      document.getElementById("handwriting-canvas"),
      3,
    );

    // Set callback for recognition
    handwritingCanvas.setCallBack(function (data, err) {
      if (err) {
        console.error(err);
        return;
      }
      displayCandidates(data);
    });

    // Set line width and color
    handwritingCanvas.setLineWidth(5);
    handwritingCanvas.setPenColor("#333333"); // Explicitly set color
    handwritingCanvas.setCap("round");
    handwritingCanvas.setLineJoin("round");

    // Controls
    document
      .getElementById("clear-canvas-btn")
      .addEventListener("click", () => {
        handwritingCanvas.erase();
        document.getElementById("candidate-words").innerHTML = "";
      });

    document.getElementById("recognize-btn").addEventListener("click", () => {
      handwritingCanvas.recognize();
    });
  } catch (e) {
    console.error("Handwriting library init failed", e);
  }
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

// Start a new round
function startNewGame() {
  if (poems.length === 0) return;

  // Pick a random poem
  const randomIndex = Math.floor(Math.random() * poems.length);
  currentPoem = poems[randomIndex];

  renderPoem();
  document.getElementById("message-area").textContent = "";
  document.getElementById("message-area").className = "";

  // Clear handwriting
  if (handwritingCanvas) handwritingCanvas.erase();
  document.getElementById("candidate-words").innerHTML = "";
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
        input.maxLength = 1;
        input.dataset.line = lineIndex;
        input.dataset.char = charIndex;

        // Add event listener for auto-focus next
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
  if (e.target.value.length === 1) {
    focusNextInput(input);
  }
}

function handleKeydown(e, input) {
  if (e.key === "Backspace" && input.value === "") {
    focusPrevInput(input);
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
