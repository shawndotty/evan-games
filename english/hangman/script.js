document.addEventListener("DOMContentLoaded", () => {
  // Game State
  let currentWordObj = null;
  let currentWord = "";
  let mistakes = 0;
  const maxMistakes = 10; // Base, Pole, Top, Rope, Head, Body, L-Arm, R-Arm, L-Leg, R-Leg
  let guessedLetters = new Set();
  let gameActive = false;
  let filteredWords = [];
  let isUpperCase = false; // State for case toggle

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
  const pronounceBtn = document.getElementById("pronounce-btn");

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

      // Determine if we should reveal all (only if lost)
      const isLost = !gameActive && mistakes >= maxMistakes;
      renderWord(isLost); // Re-render word

      // Also update any guessed status on the new keyboard
      restoreKeyboardStatus();

      // Update Game Over message if visible
      if (isLost) {
        const displayWord = isUpperCase
          ? currentWord
          : currentWord.toLowerCase();
        messageDisplay.textContent = `Game Over! The word was: ${displayWord}`;
      }
    });

    hintBtn.addEventListener("click", () => {
      useHint();
    });

    pronounceBtn.addEventListener("click", () => {
      speakWord();
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
      animateToStep(mistakes); // Animate the new part
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

  function speakWord() {
    if (!currentWord) return;

    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(currentWord.toLowerCase());
    utterance.lang = "en-US";
    utterance.rate = 0.8; // Slightly slower for clarity
    window.speechSynthesis.speak(utterance);
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
    // Static redraw (e.g. resize or init)
    drawStaticParts(step);
    // If game over, draw eyes
    if (step >= maxMistakes) {
      drawEyes();
    }
  }

  // New function for animated drawing
  function animateToStep(targetStep) {
    const duration = 500; // ms
    const startTime = performance.now();

    // Start pencil sound
    sounds.startPencil();

    function loop(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Clear and redraw everything up to previous step
      drawStaticParts(targetStep - 1);

      // Draw current step with progress
      drawPart(targetStep, progress);

      if (progress < 1.0) {
        requestAnimationFrame(loop);
      } else {
        // Animation done
        sounds.stopPencil();
        // Ensure final state is clean
        drawStaticParts(targetStep);

        // If this was the last step, draw eyes
        if (targetStep >= maxMistakes) {
          drawEyes();
        }
      }
    }

    requestAnimationFrame(loop);
  }

  function drawStaticParts(maxStep) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#2C3E50";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 1; i <= maxStep; i++) {
      drawPart(i, 1.0);
    }
  }

  // Generic draw part function
  function drawPart(step, progress) {
    ctx.beginPath();

    if (step === 1) {
      // Base
      // (100, 540) -> (500, 540)
      drawLine(100, 540, 500, 540, progress);
    } else if (step === 2) {
      // Pole
      // (200, 540) -> (200, 60)
      drawLine(200, 540, 200, 60, progress);
    } else if (step === 3) {
      // Top
      // Two parts: Top Bar + Support
      // Split progress: 0-0.7 for Top Bar, 0.7-1.0 for Support

      // Top Bar: (200, 60) -> (400, 60)
      const p1 = Math.min(progress / 0.7, 1.0);
      drawLine(200, 60, 400, 60, p1);

      // Support: (200, 120) -> (260, 60)
      if (progress > 0.7) {
        const p2 = (progress - 0.7) / 0.3;
        drawLine(200, 120, 260, 60, p2);
      }
    } else if (step === 4) {
      // Rope
      // (400, 60) -> (400, 120)
      drawLine(400, 60, 400, 120, progress);
    } else if (step === 5) {
      // Head
      // Arc: Center (400, 160), Radius 40
      ctx.beginPath();
      // Draw full circle incrementally
      const endAngle = progress * Math.PI * 2;
      ctx.arc(400, 160, 40, 0, endAngle);
      ctx.stroke();

      // X Eyes only if game over (mistakes >= maxMistakes)
      // But this function is generic drawPart.
      // Let's handle eyes separately or just at the end of game.
      // Current logic draws eyes inside drawHead if mistakes >= max.
      // We should probably only draw eyes when the game is actually lost.
      // For animation, we skip eyes.
    } else if (step === 6) {
      // Body
      // (400, 200) -> (400, 360)
      drawLine(400, 200, 400, 360, progress);
    } else if (step === 7) {
      // Left Arm
      // (400, 240) -> (340, 300)
      drawLine(400, 240, 340, 300, progress);
    } else if (step === 8) {
      // Right Arm
      // (400, 240) -> (460, 300)
      drawLine(400, 240, 460, 300, progress);
    } else if (step === 9) {
      // Left Leg
      // (400, 360) -> (340, 460)
      drawLine(400, 360, 340, 460, progress);
    } else if (step === 10) {
      // Right Leg
      // (400, 360) -> (460, 460)
      drawLine(400, 360, 460, 460, progress);

      // If finished and lost, maybe draw eyes?
      // But drawPart is called during animation loop.
      // Let's handle eyes in drawStaticParts or specialized logic.
    }
  }

  function drawLine(x1, y1, x2, y2, progress) {
    if (progress <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const currentX = x1 + (x2 - x1) * progress;
    const currentY = y1 + (y2 - y1) * progress;
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
  }

  // Draw Eyes (Static helper)
  function drawEyes() {
    ctx.lineWidth = 4;
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
    ctx.lineWidth = 8; // Restore
  }

  // Start
  init();
});
