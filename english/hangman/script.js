document.addEventListener("DOMContentLoaded", () => {
  // Game State
  let currentWordObj = null;
  let currentWord = "";
  let mistakes = 0;
  const maxMistakes = 6; // Head, Body, L-Arm, R-Arm, L-Leg, R-Leg
  let guessedLetters = new Set();
  let gameActive = false;
  let filteredWords = [];

  // DOM Elements
  const vowelsContainer = document.getElementById("vowels-container");
  const consonantsContainer = document.getElementById("consonants-container");
  const wordDisplay = document.getElementById("word-display");
  const messageDisplay = document.getElementById("game-message");
  const canvas = document.getElementById("hangman-canvas");
  const ctx = canvas.getContext("2d");

  // Controls
  const librarySelect = document.getElementById("library-select");
  const gradeSelect = document.getElementById("grade-select");
  const difficultySelect = document.getElementById("difficulty-select");
  const newGameBtn = document.getElementById("new-game-btn");

  // Constants
  const VOWELS = "AEIOU".split("");
  const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split("");

  // Initialize
  function init() {
    createKeyboard();
    addEventListeners();
    startNewGame();
  }

  function createKeyboard() {
    // Vowels
    vowelsContainer.innerHTML = "";
    VOWELS.forEach((letter) => {
      const btn = createLetterButton(letter);
      vowelsContainer.appendChild(btn);
    });

    // Consonants
    consonantsContainer.innerHTML = "";
    CONSONANTS.forEach((letter) => {
      const btn = createLetterButton(letter);
      consonantsContainer.appendChild(btn);
    });
  }

  function createLetterButton(letter) {
    const btn = document.createElement("button");
    btn.classList.add("letter-btn");
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener("click", () => handleGuess(letter));
    return btn;
  }

  function addEventListeners() {
    newGameBtn.addEventListener("click", startNewGame);
    // We can also restart game when filters change, or wait for user to click New Game.
    // Usually better to wait for click to avoid disrupting current game unexpectedly.
    // But let's trigger new game if user changes filters to give immediate feedback?
    // Let's stick to the button for "New Game".
  }

  function filterWords() {
    const libraryKey = librarySelect.value; // currently only 'elementary'
    const gradeVal = gradeSelect.value;
    const difficultyVal = difficultySelect.value;

    let words = wordLibrary[libraryKey] || [];

    // Filter by Grade
    if (gradeVal !== "all") {
      words = words.filter((item) => item.grade == gradeVal);
    }

    // Filter by Difficulty
    if (difficultyVal !== "all") {
      words = words.filter((item) => {
        const len = item.word.length;
        if (difficultyVal === "easy") return len < 5;
        if (difficultyVal === "medium") return len >= 5 && len <= 7;
        if (difficultyVal === "hard") return len >= 8;
        return true;
      });
    }

    return words;
  }

  function startNewGame() {
    // 1. Filter words
    filteredWords = filterWords();

    if (filteredWords.length === 0) {
      alert(
        "No words found for this selection! Please try different settings.",
      );
      return;
    }

    // 2. Pick random word
    const randomIndex = Math.floor(Math.random() * filteredWords.length);
    currentWordObj = filteredWords[randomIndex];
    currentWord = currentWordObj.word.toUpperCase();

    console.log("Target Word:", currentWord); // Debugging

    // 3. Reset State
    mistakes = 0;
    guessedLetters.clear();
    gameActive = true;
    messageDisplay.textContent = "";
    messageDisplay.className = "hidden";

    // 4. Reset UI
    resetKeyboard();
    renderWord();
    drawHangman(0); // Draw initial state (Gallows)
  }

  function resetKeyboard() {
    const buttons = document.querySelectorAll(".letter-btn");
    buttons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("correct", "wrong");
    });
  }

  function renderWord(revealAll = false) {
    wordDisplay.innerHTML = "";
    const letters = currentWord.split("");

    letters.forEach((letter) => {
      const slot = document.createElement("div");
      slot.classList.add("letter-slot");

      if (guessedLetters.has(letter) || revealAll) {
        slot.textContent = letter;
        slot.classList.add("revealed");

        if (revealAll && !guessedLetters.has(letter)) {
          slot.classList.add("missed");
        }
      } else {
        slot.textContent = ""; // Hidden
      }

      wordDisplay.appendChild(slot);
    });
  }

  function handleGuess(letter) {
    if (!gameActive || guessedLetters.has(letter)) return;

    guessedLetters.add(letter);

    // Disable button
    const btn = document.querySelector(`.letter-btn[data-letter="${letter}"]`);
    if (btn) btn.disabled = true;

    if (currentWord.includes(letter)) {
      // Correct guess
      if (btn) btn.classList.add("correct");
      renderWord();
      checkWin();
    } else {
      // Wrong guess
      if (btn) btn.classList.add("wrong");
      mistakes++;
      drawHangman(mistakes);
      checkLoss();
    }
  }

  function checkWin() {
    const letters = currentWord.split("");
    const allGuessed = letters.every((l) => guessedLetters.has(l));

    if (allGuessed) {
      gameActive = false;
      messageDisplay.textContent = "🎉 Great Job! You Won! 🎉";
      messageDisplay.className = "win-msg";
      playWinEffect();
    }
  }

  function checkLoss() {
    if (mistakes >= maxMistakes) {
      gameActive = false;
      messageDisplay.textContent = `Game Over! The word was: ${currentWord}`;
      messageDisplay.className = "lose-msg";
      renderWord(true); // Reveal answer
    }
  }

  function playWinEffect() {
    // Simple confetti or animation could go here
    // For now, just a console log
    console.log("Winner!");
  }

  // --- Canvas Drawing ---
  function drawHangman(step) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 8; // Scaled up line width
    ctx.strokeStyle = "#2C3E50";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw Gallows (Always visible or base visible)
    // Scaled by 2x for 600x600 canvas

    // Base
    ctx.beginPath();
    ctx.moveTo(100, 540);
    ctx.lineTo(500, 540);
    ctx.stroke();

    // Pole
    ctx.beginPath();
    ctx.moveTo(200, 540);
    ctx.lineTo(200, 60);
    ctx.stroke();

    // Top
    ctx.beginPath();
    ctx.moveTo(200, 60);
    ctx.lineTo(400, 60);
    ctx.stroke();

    // Rope
    ctx.beginPath();
    ctx.moveTo(400, 60);
    ctx.lineTo(400, 120);
    ctx.stroke();

    // Support
    ctx.beginPath();
    ctx.moveTo(200, 120);
    ctx.lineTo(260, 60);
    ctx.stroke();

    // Parts based on mistakes
    if (step >= 1) drawHead();
    if (step >= 2) drawBody();
    if (step >= 3) drawLeftArm();
    if (step >= 4) drawRightArm();
    if (step >= 5) drawLeftLeg();
    if (step >= 6) drawRightLeg();
  }

  function drawHead() {
    ctx.beginPath();
    ctx.arc(400, 160, 40, 0, Math.PI * 2); // Center 400, 160, Radius 40
    ctx.stroke();

    // Happy/Sad face depending on game state?
    // Let's just draw a neutral face for now, or X eyes if dead?
    if (mistakes >= maxMistakes) {
      // X Eyes
      ctx.beginPath();
      // Left Eye X
      ctx.moveTo(384, 150);
      ctx.lineTo(396, 162);
      ctx.moveTo(396, 150);
      ctx.lineTo(384, 162);
      // Right Eye X
      ctx.moveTo(404, 150);
      ctx.lineTo(416, 162);
      ctx.moveTo(416, 150);
      ctx.lineTo(404, 162);
      ctx.stroke();
    }
  }

  function drawBody() {
    ctx.beginPath();
    ctx.moveTo(400, 200);
    ctx.lineTo(400, 360);
    ctx.stroke();
  }

  function drawLeftArm() {
    ctx.beginPath();
    ctx.moveTo(400, 240);
    ctx.lineTo(340, 300);
    ctx.stroke();
  }

  function drawRightArm() {
    ctx.beginPath();
    ctx.moveTo(400, 240);
    ctx.lineTo(460, 300);
    ctx.stroke();
  }

  function drawLeftLeg() {
    ctx.beginPath();
    ctx.moveTo(400, 360);
    ctx.lineTo(340, 460);
    ctx.stroke();
  }

  function drawRightLeg() {
    ctx.beginPath();
    ctx.moveTo(400, 360);
    ctx.lineTo(460, 460);
    ctx.stroke();
  }

  // Start
  init();
});
