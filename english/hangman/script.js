document.addEventListener("DOMContentLoaded", () => {
  // Game State
  let currentWordObj = null;
  let currentWord = "";
  let mistakes = 0;
  const maxMistakes = 10; // Base, Pole, Top, Rope, Head, Body, L-Arm, R-Arm, L-Leg, R-Leg
  let guessedLetters = new Set();
  let gameActive = false;
  let filteredWords = [];
  let isUpperCase = true; // State for case toggle

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
  const toggleCaseBtn = document.getElementById("toggle-case-btn");
  const hintBtn = document.getElementById("hint-btn");

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
    // Display text based on case, but data-letter stays UPPERCASE for logic
    btn.textContent = isUpperCase ? letter : letter.toLowerCase();
    btn.dataset.letter = letter; // Always UPPERCASE
    btn.addEventListener("click", () => handleGuess(letter));
    return btn;
  }

  function addEventListeners() {
    newGameBtn.addEventListener("click", () => {
      sounds.click();
      startNewGame();
    });

    toggleCaseBtn.addEventListener("click", () => {
      isUpperCase = !isUpperCase;
      sounds.click();
      createKeyboard(); // Re-render keyboard
      renderWord(); // Re-render word
      // Also update any guessed status on the new keyboard
      restoreKeyboardStatus();
    });

    hintBtn.addEventListener("click", () => {
      useHint();
    });
  }

  function restoreKeyboardStatus() {
    // Re-apply disabled/correct/wrong states to the new keyboard buttons
    guessedLetters.forEach((letter) => {
      // letter is always stored as uppercase in logic
      const displayLetter = isUpperCase ? letter : letter.toLowerCase();
      // Note: our dataset.letter is what we use for selection.
      // If we change display, we should probably keep dataset.letter consistent or handle the mapping.
      // Let's decide: Logic always uses UPPERCASE.
      // UI Buttons: textContent changes, dataset.letter always UPPERCASE to simplify logic.

      const btn = document.querySelector(
        `.letter-btn[data-letter="${letter}"]`,
      );
      if (btn) {
        btn.disabled = true;
        if (currentWord.includes(letter)) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("wrong");
        }
      }
    });
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
    updateHintButton(); // Check hint status for new word
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

      // Logic uses UPPERCASE. Display uses current case setting.
      const displayChar = isUpperCase ? letter : letter.toLowerCase();

      if (guessedLetters.has(letter) || revealAll) {
        slot.textContent = displayChar;
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
      sounds.correct();
      renderWord();
      checkWin();
    } else {
      // Wrong guess
      if (btn) btn.classList.add("wrong");
      sounds.wrong();
      mistakes++;
      drawHangman(mistakes);
      checkLoss();
    }

    // Update hint button status
    updateHintButton();
  }

  function useHint() {
    if (!gameActive) return;

    // Find all unguested correct letters
    const letters = currentWord.split("");
    const unrevealedCorrect = [
      ...new Set(letters.filter((l) => !guessedLetters.has(l))),
    ];

    // Security check: if only 1 left, should be disabled, but if called anyway, return.
    if (unrevealedCorrect.length <= 1) {
      // This case should ideally be prevented by UI disabling, but good to have safeguard
      return;
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * unrevealedCorrect.length);
    const hintLetter = unrevealedCorrect[randomIndex];

    // Simulate guess
    sounds.click(); // Or a special hint sound
    handleGuess(hintLetter);
  }

  function updateHintButton() {
    if (!gameActive) {
      hintBtn.disabled = true;
      return;
    }

    const letters = currentWord.split("");
    const unrevealedCorrect = [
      ...new Set(letters.filter((l) => !guessedLetters.has(l))),
    ];

    // Disable if 1 or 0 letters left
    if (unrevealedCorrect.length <= 1) {
      hintBtn.disabled = true;
    } else {
      hintBtn.disabled = false;
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
      sounds.win();
      updateHintButton(); // Disable hint
    }
  }

  function checkLoss() {
    if (mistakes >= maxMistakes) {
      gameActive = false;
      const displayWord = isUpperCase ? currentWord : currentWord.toLowerCase();
      messageDisplay.textContent = `Game Over! The word was: ${displayWord}`;
      messageDisplay.className = "lose-msg";
      renderWord(true); // Reveal answer
      sounds.lose();
      updateHintButton(); // Disable hint
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

    // Incremental Drawing Steps
    if (step >= 1) drawBase();
    if (step >= 2) drawPole();
    if (step >= 3) drawTop();
    if (step >= 4) drawRope();
    if (step >= 5) drawHead();
    if (step >= 6) drawBody();
    if (step >= 7) drawLeftArm();
    if (step >= 8) drawRightArm();
    if (step >= 9) drawLeftLeg();
    if (step >= 10) drawRightLeg();
  }

  function drawBase() {
    ctx.beginPath();
    ctx.moveTo(100, 540);
    ctx.lineTo(500, 540);
    ctx.stroke();
  }

  function drawPole() {
    ctx.beginPath();
    ctx.moveTo(200, 540);
    ctx.lineTo(200, 60);
    ctx.stroke();
  }

  function drawTop() {
    // Top bar
    ctx.beginPath();
    ctx.moveTo(200, 60);
    ctx.lineTo(400, 60);
    ctx.stroke();

    // Support (Diagonal)
    ctx.beginPath();
    ctx.moveTo(200, 120);
    ctx.lineTo(260, 60);
    ctx.stroke();
  }

  function drawRope() {
    ctx.beginPath();
    ctx.moveTo(400, 60);
    ctx.lineTo(400, 120);
    ctx.stroke();
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
