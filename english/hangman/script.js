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
  const soundToggleBtn = document.getElementById("sound-toggle-btn");
  const toggleCaseBtn = document.getElementById("toggle-case-btn");
  const hintBtn = document.getElementById("hint-btn");
  const pronounceBtn = document.getElementById("pronounce-btn");
  const revealVowelsBtn = document.getElementById("reveal-vowels-btn");
  const synonymBtn = document.getElementById("synonym-btn");
  const synonymDisplay = document.getElementById("synonym-display");

  // Explain Modal Elements
  const explainBtn = document.getElementById("explain-btn");
  const modal = document.getElementById("explain-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalOverlay = document.querySelector(".modal-overlay");
  const modalWord = document.getElementById("modal-word");
  const modalDefinition = document.getElementById("modal-definition");

  // TTS Voice
  let selectedVoice = null;
  let pronounceClickCount = 0;

  // Audio Cache
  const audioCache = {};
  let currentAudio = null;

  // Timer for auto next game
  let autoNextGameTimer = null;

  // Constants
  const VOWELS = "AEIOU".split("");
  const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split("");

  // Initialize
  function init() {
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    createKeyboard();
    addEventListeners();
    startNewGame();
  }

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices();

    // Priority:
    // 1. "Google US English" (Chrome)
    // 2. "Samantha" (macOS)
    // 3. Any "en-US"
    // 4. Any "en"

    selectedVoice =
      voices.find((v) => v.name === "Google US English") ||
      voices.find((v) => v.name === "Samantha") ||
      voices.find((v) => v.lang === "en-US") ||
      voices.find((v) => v.lang.startsWith("en"));

    console.log(
      "Selected Voice:",
      selectedVoice ? selectedVoice.name : "Default",
    );
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

    if (soundToggleBtn) {
      soundToggleBtn.addEventListener("click", () => {
        const isMuted = sounds.toggleMute();
        // Update button text/icon
        if (isMuted) {
          soundToggleBtn.textContent = "🔇 Mute";
          soundToggleBtn.classList.add("muted");
        } else {
          soundToggleBtn.textContent = "🔊 Sound";
          soundToggleBtn.classList.remove("muted");
          sounds.click(); // Play click only when turning sound ON
        }
      });
    }

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

    revealVowelsBtn.addEventListener("click", () => {
      revealVowels();
    });

    synonymBtn.addEventListener("click", () => {
      showSynonyms();
    });

    // Explain Modal Listeners
    if (explainBtn) {
      explainBtn.addEventListener("click", () => {
        openExplainModal();
      });
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        closeExplainModal();
      });
    }

    if (modalOverlay) {
      modalOverlay.addEventListener("click", () => {
        closeExplainModal();
      });
    }
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
    // Clear any pending auto-next game timer
    if (autoNextGameTimer) {
      clearTimeout(autoNextGameTimer);
      autoNextGameTimer = null;
    }

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
    pronounceClickCount = 0; // Reset pronounce speed cycle
    if (pronounceBtn) pronounceBtn.textContent = "🔊 Pronounce"; // Reset button text
    messageDisplay.textContent = "";
    messageDisplay.className = "hidden";

    // 4. Reset UI
    resetKeyboard();
    renderWord();
    drawHangman(0); // Draw initial state (Gallows)
    updateHintButton(); // Check hint status for new word
    updateVowelsButton(); // Reset vowel button state

    // Reset Synonym Display
    synonymDisplay.textContent = "";
    synonymDisplay.classList.add("hidden");
    if (synonymBtn) synonymBtn.disabled = false;

    // Enable Explain button by default
    if (explainBtn) explainBtn.disabled = false;
  }

  async function showSynonyms() {
    synonymDisplay.textContent = "Loading synonyms...";
    synonymDisplay.classList.remove("hidden");

    try {
      // Use Datamuse API to find synonyms (rel_syn)
      const response = await fetch(
        `https://api.datamuse.com/words?rel_syn=${currentWord.toLowerCase()}&max=3`,
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const synonyms = data.map((item) => item.word).join(", ");
        synonymDisplay.textContent = `Synonyms: ${synonyms}`;
      } else {
        synonymDisplay.textContent = "No synonyms found.";
      }
    } catch (error) {
      console.error("Error fetching synonyms:", error);
      synonymDisplay.textContent = "Could not load synonyms (Network Error).";
    }
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
    updateVowelsButton();
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

  function stopAllAudio() {
    // 1. Cancel TTS
    window.speechSynthesis.cancel();

    // 2. Stop Real Audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }

  async function speakWord() {
    if (!currentWord) return;

    // Immediately stop any previous sound to avoid overlap or glitches
    stopAllAudio();

    const lowerWord = currentWord.toLowerCase();

    // Rate logic: 1st click normal (1.0), 2nd slow (0.8), 3rd very slow (0.6), 4th normal
    // Adjusted to avoid severe audio distortion at very low rates (which sounds like "mono" or bad quality)
    const rates = [1.0, 0.8, 0.6];
    const rate = rates[pronounceClickCount % 3];
    pronounceClickCount++;

    // Reset click count to avoid integer overflow (though unlikely) and keep it clean
    if (pronounceClickCount >= 3) {
      pronounceClickCount = 0;
    }

    // Update button text to show current speed
    const speedLabels = ["Normal", "Slow", "Slower"];
    // Note: We display the label corresponding to the rate we JUST chose
    const currentLabel = speedLabels[rates.indexOf(rate)];
    pronounceBtn.textContent = `🔊 ${currentLabel}`;

    console.log(`Speaking '${currentWord}' at rate: ${rate}`);

    // Try to play real human audio first
    try {
      await playRealAudio(lowerWord, rate);
    } catch (e) {
      console.warn("Real audio failed, falling back to TTS:", e);
      playTTS(lowerWord, rate);
    }
  }

  function playRealAudio(word, rate) {
    return new Promise(async (resolve, reject) => {
      let audioUrl = audioCache[word];

      if (!audioUrl) {
        try {
          const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
          );
          if (!response.ok) throw new Error("API request failed");
          const data = await response.json();

          // Find first valid audio URL
          const phonetics = data[0]?.phonetics || [];
          const audioEntry = phonetics.find((p) => p.audio && p.audio !== "");

          if (audioEntry) {
            audioUrl = audioEntry.audio;
            audioCache[word] = audioUrl; // Cache it
          } else {
            throw new Error("No audio found");
          }
        } catch (err) {
          return reject(err);
        }
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.playbackRate = rate;

        // Update global reference
        currentAudio = audio;

        audio.onended = () => {
          if (currentAudio === audio) {
            currentAudio = null;
          }
          resolve();
        };

        audio.onerror = (e) => {
          if (currentAudio === audio) {
            currentAudio = null;
          }
          reject(e);
        };

        // Ensure TTS is cancelled right before play (redundant but safe)
        window.speechSynthesis.cancel();

        audio.play().catch(reject);
      } else {
        reject(new Error("No audio URL"));
      }
    });
  }

  function playTTS(word, rate) {
    // Retry loading voices if not selected yet (fix for async loading)
    if (!selectedVoice) {
      loadVoices();
    }

    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(word);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Reset button text after audio finishes (approximate) or keep it?
    // Let's keep it to show state, but reset on new game.

    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Cancel any current speaking to avoid queue buildup
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function revealVowels() {
    if (!gameActive) return;

    sounds.click();

    // Identify vowels present in the current word that haven't been guessed
    const letters = currentWord.split("");
    const presentVowels = [
      ...new Set(
        letters.filter((l) => VOWELS.includes(l) && !guessedLetters.has(l)),
      ),
    ];

    if (presentVowels.length === 0) {
      // Maybe all vowels are already guessed or no vowels in word?
      // Just in case, though button should be disabled.
      return;
    }

    presentVowels.forEach((vowel) => {
      handleGuess(vowel);
    });
  }

  function updateVowelsButton() {
    if (!gameActive) {
      revealVowelsBtn.disabled = true;
      return;
    }

    // Check if there are any unrevealed vowels in the current word
    const letters = currentWord.split("");
    const hasUnrevealedVowels = letters.some(
      (l) => VOWELS.includes(l) && !guessedLetters.has(l),
    );

    revealVowelsBtn.disabled = !hasUnrevealedVowels;
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
      updateVowelsButton(); // Disable vowels button

      // Note: Explain button remains enabled

      // Auto start next game after 2 seconds
      autoNextGameTimer = setTimeout(() => {
        startNewGame();
      }, 2000);
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
      updateVowelsButton(); // Disable vowels button
      // Note: Explain button remains disabled on loss as per user request
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

  // --- Explain Feature ---

  function openExplainModal() {
    if (!currentWord) return;

    modal.classList.remove("hidden");

    // Hide the word itself, just show "Definition Hint" or similar
    modalWord.textContent = "Word Definition";
    modalDefinition.textContent = "Loading definition...";

    fetchDefinition(currentWord.toLowerCase());
  }

  function closeExplainModal() {
    modal.classList.add("hidden");
  }

  async function fetchDefinition(word) {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      );
      if (!response.ok) throw new Error("Word not found");
      const data = await response.json();

      // Extract first definition
      if (
        data &&
        data.length > 0 &&
        data[0].meanings &&
        data[0].meanings.length > 0
      ) {
        // Try to find a noun or verb definition first as they are most common for kids words
        let meaning =
          data[0].meanings.find(
            (m) => m.partOfSpeech === "noun" || m.partOfSpeech === "verb",
          ) || data[0].meanings[0];

        const firstDef = meaning.definitions[0].definition;
        modalDefinition.textContent = firstDef;
      } else {
        modalDefinition.textContent = "No definition found.";
      }
    } catch (error) {
      console.error("Definition error:", error);
      modalDefinition.textContent = "Could not load definition.";
    }
  }

  function fetchImage(word) {
    // Use Pollinations.ai with a kid-friendly prompt
    const prompt = `cute illustration of ${word} for kids, simple, colorful, vector style, white background`;
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=400&nologo=true`;

    modalImage.src = imageUrl;
    modalImage.onload = () => {
      modalImage.classList.remove("hidden");
    };
    modalImage.onerror = () => {
      modalImage.classList.add("hidden");
    };
  }

  // Start
  init();
});
