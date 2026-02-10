document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentTopic = null;
  let currentSentenceIndex = 0;
  let currentSentence = "";
  let currentWords = [];
  let blanks = []; // { index, word, element }
  let currentMode = "input"; // input, select, sort
  let currentDifficulty = "medium";
  let lastFocusedInput = null;
  const soundManager = new SoundManager();

  // DOM Elements
  const sentenceContent = document.getElementById("sentence-content");
  const sentenceTitle = document.getElementById("sentence-title");
  const sentenceAuthor = document.getElementById("sentence-author");
  const messageArea = document.getElementById("message-area");
  const pool = document.getElementById("selection-pool");
  const topicSelect = document.getElementById("topic-select");
  const modeSelect = document.getElementById("mode-select");
  const difficultySelect = document.getElementById("difficulty-select");
  const newGameBtn = document.getElementById("new-game-btn");
  const checkBtn = document.getElementById("check-btn");
  const hintBtn = document.getElementById("hint-btn");
  const hintSentenceBtn = document.getElementById("hint-sentence-btn");
  const restartBtn = document.getElementById("restart-btn");
  const soundToggleBtn = document.getElementById("sound-toggle-btn");
  const pickTopicBtn = document.getElementById("pick-topic-btn");
  const modal = document.getElementById("topic-modal");
  const closeModal = document.querySelector(".close-modal");
  const topicList = document.getElementById("topic-list");

  // Init
  initGame();

  function initGame() {
    initTopicSelect();
    initEventListeners();
    startNewGame();
  }

  function initTopicSelect() {
    // Populate select dropdown
    sentencesData.forEach((topic, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = topic.title;
      topicSelect.appendChild(option);
    });
  }

  function initEventListeners() {
    newGameBtn.addEventListener("click", startNewGame);
    checkBtn.addEventListener("click", checkAnswer);
    hintBtn.addEventListener("click", showHintWord);
    hintSentenceBtn.addEventListener("click", showHintSentence);
    restartBtn.addEventListener("click", resetCurrentGame);

    soundToggleBtn.addEventListener("click", () => {
      const isMuted = soundManager.toggleMute();
      soundToggleBtn.textContent = isMuted ? "🔇 Sound" : "🔊 Sound";
      soundManager.click();
    });

    modeSelect.addEventListener("change", (e) => {
      currentMode = e.target.value;
      renderSentence();
    });

    difficultySelect.addEventListener("change", (e) => {
      currentDifficulty = e.target.value;
      renderSentence();
    });

    topicSelect.addEventListener("change", () => {
      startNewGame();
    });

    pickTopicBtn.addEventListener("click", () => {
      renderTopicList();
      modal.classList.remove("hidden");
    });

    closeModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  function startNewGame() {
    let topicIndex = topicSelect.value;

    // Pick random topic if "all"
    if (topicIndex === "all") {
      topicIndex = Math.floor(Math.random() * sentencesData.length);
    }

    currentTopic = sentencesData[topicIndex];

    // Pick random sentence from topic
    currentSentenceIndex = Math.floor(
      Math.random() * currentTopic.content.length,
    );
    currentSentence = currentTopic.content[currentSentenceIndex];

    sentenceTitle.textContent = currentTopic.title;
    sentenceAuthor.textContent = currentTopic.author
      ? `- ${currentTopic.author}`
      : "";

    renderSentence();
    messageArea.textContent = "";
    messageArea.style.color = "var(--text-color)";
  }

  function renderSentence() {
    sentenceContent.innerHTML = "";
    blanks = [];
    lastFocusedInput = null; // Reset focused input
    messageArea.textContent = "";
    pool.classList.add("hidden");
    checkBtn.disabled = false; // Reset button state

    // Remove punctuation for tokenization but keep for display?
    // We want to preserve punctuation in the sentence line.
    // Let's split by spaces but attach punctuation to the word for display,
    // but separate for "blanking" logic if possible.
    // Simple approach: Split by space.

    const rawWords = currentSentence.split(" ");
    currentWords = rawWords.map((w) => {
      // Clean word for checking (remove punctuation)
      const clean = w.replace(/[.,!?;:"'()]/g, "");
      return {
        display: w,
        clean: clean,
        punctuation: w.replace(clean, ""), // This is rough, e.g. "don't" -> "dont" + "'" fails.
        // Better regex: match word characters vs non-word
      };
    });

    // Better splitting
    // We will just process the sentence string.
    // Actually, "Word" based games usually treat "don't" as one word or "don" + "t".
    // Let's stick to space separation for simplicity in "Sentence Builder".

    if (currentMode === "sort") {
      renderSortMode(rawWords);
    } else {
      renderFillMode(rawWords);
    }
  }

  function renderSortMode(words) {
    const line = document.createElement("div");
    line.className = "sentence-line";

    // Shuffle words
    let shuffled = [...words];
    // Simple shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffled.forEach((word) => {
      const el = document.createElement("div");
      el.className = "sort-word";
      el.textContent = word;
      el.draggable = true;

      el.addEventListener("dragstart", handleDragStart);
      el.addEventListener("dragover", handleDragOver);
      el.addEventListener("drop", handleDrop);
      el.addEventListener("click", handleSortClick);

      line.appendChild(el);
    });

    sentenceContent.appendChild(line);
  }

  let selectedSortWord = null;

  function handleSortClick(e) {
    const target = e.target;
    if (selectedSortWord) {
      soundManager.click();
      // Swap text
      const temp = selectedSortWord.textContent;
      selectedSortWord.textContent = target.textContent;
      target.textContent = temp;

      selectedSortWord.classList.remove("selected");
      selectedSortWord = null;
    } else {
      soundManager.click();
      selectedSortWord = target;
      target.classList.add("selected");
    }
  }

  // Drag and Drop Logic (Reuse from Chinese game simplified)
  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
    this.classList.add("dragging");
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcEl !== this) {
      soundManager.click();
      // Swap content
      const temp = this.textContent;
      this.textContent = dragSrcEl.textContent;
      dragSrcEl.textContent = temp;
    }
    return false;
  }

  // End Drag
  document.addEventListener("dragend", (e) => {
    if (e.target.classList) e.target.classList.remove("dragging");
  });

  function renderFillMode(words) {
    const line = document.createElement("div");
    line.className = "sentence-line";

    // Determine blanks
    let blankIndices = [];
    const eligibleIndices = words.map((w, i) => i);

    // Difficulty logic
    let blankCount = 0;
    const len = words.length;
    if (currentDifficulty === "easy") blankCount = Math.ceil(len * 0.3);
    else if (currentDifficulty === "medium") blankCount = Math.ceil(len * 0.5);
    else blankCount = Math.ceil(len * 0.8);

    // Shuffle indices
    for (let i = eligibleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligibleIndices[i], eligibleIndices[j]] = [
        eligibleIndices[j],
        eligibleIndices[i],
      ];
    }
    blankIndices = eligibleIndices.slice(0, blankCount);

    words.forEach((word, index) => {
      // Common regex to split punctuation
      const match = word.match(/^([^\w]*)([\w'-]+)([^\w]*)$/);
      let pre = "",
        core = word,
        post = "";

      if (match) {
        pre = match[1];
        core = match[2];
        post = match[3];
      } else {
        // Fallback for purely punctuation or weird tokens
        // If it's just punctuation, render as text, no pill
        if (!/[a-zA-Z0-9]/.test(word)) {
          const span = document.createElement("span");
          span.className = "punctuation";
          span.textContent = word;
          line.appendChild(span);
          return;
        }
      }

      if (pre) {
        const s = document.createElement("span");
        s.className = "punctuation";
        s.textContent = pre;
        line.appendChild(s);
      }

      if (blankIndices.includes(index)) {
        // It's a blank
        const input = document.createElement("input");
        input.type = "text";
        input.className = "word-input";
        input.dataset.correct = core;
        input.dataset.full = word;

        // Width based on length + padding
        input.style.width = `${Math.max(80, core.length * 14 + 20)}px`;

        input.addEventListener("focus", () => {
          lastFocusedInput = input;
        });

        if (currentMode === "select") {
          input.readOnly = true;
          input.style.cursor = "pointer";
          input.addEventListener("click", () => {
            lastFocusedInput = input;
            // Trigger pool highlight if needed
          });
        }

        line.appendChild(input);
        blanks.push({ element: input, correct: core });
      } else {
        // Normal word - make it a pill
        const span = document.createElement("span");
        span.className = "word-box";
        span.textContent = core;
        line.appendChild(span);
      }

      if (post) {
        const s = document.createElement("span");
        s.className = "punctuation";
        s.textContent = post;
        line.appendChild(s);
      }
    });

    sentenceContent.appendChild(line);

    if (currentMode === "select") {
      renderSelectionPool();
    }
  }

  function renderSelectionPool() {
    pool.innerHTML = "";
    pool.classList.remove("hidden");

    // Collect correct words
    let words = blanks.map((b) => b.correct);

    // Add distractors (simple shuffle or random words from other sentences would be better,
    // but for now let's just use the correct words + maybe duplicate common ones?)
    // To make it harder, we could fetch random words from the topic.

    // Shuffle
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }

    words.forEach((word) => {
      const btn = document.createElement("div");
      btn.className = "pool-word";
      btn.textContent = word;
      btn.addEventListener("click", () => handlePoolSelect(word, btn));
      pool.appendChild(btn);
    });
  }

  function handlePoolSelect(word, btn) {
    if (btn.classList.contains("muted")) return;

    soundManager.click();

    if (!lastFocusedInput) {
      // Find first empty
      lastFocusedInput = blanks.find((b) => !b.element.value)?.element;
      if (!lastFocusedInput && blanks.length > 0)
        lastFocusedInput = blanks[0].element;
    }

    if (lastFocusedInput) {
      // If input had value from a previous pool selection, un-mute that button
      if (lastFocusedInput.poolBtn) {
        lastFocusedInput.poolBtn.classList.remove("muted");
      }

      lastFocusedInput.value = word;
      lastFocusedInput.classList.remove("incorrect");
      lastFocusedInput.classList.remove("correct");

      // Link this button to the input and mute it
      lastFocusedInput.poolBtn = btn;
      btn.classList.add("muted");

      // Move to next empty or next input
      const idx = blanks.findIndex((b) => b.element === lastFocusedInput);
      if (idx !== -1 && idx < blanks.length - 1) {
        const nextEmpty = blanks.slice(idx + 1).find((b) => !b.element.value);
        if (nextEmpty) {
          lastFocusedInput = nextEmpty.element;
        } else {
          lastFocusedInput = blanks[idx + 1].element;
        }
        lastFocusedInput.focus();
      }
    }
  }

  function checkAnswer() {
    let correctCount = 0;
    let isWin = false;

    if (currentMode === "sort") {
      const words = document.querySelectorAll(".sort-word");
      const currentArr = Array.from(words).map((w) => w.textContent);
      const correctArr = currentSentence.split(" ");

      // This simple check implies exact match.
      // If sorting was randomized well, unique words are easy.
      // Duplicate words might be tricky if we check by index.
      // Let's check visually: content at index i == correctArr[i]

      let allCorrect = true;
      words.forEach((w, i) => {
        if (w.textContent === correctArr[i]) {
          w.classList.add("correct");
          w.classList.remove("incorrect");
        } else {
          w.classList.add("incorrect");
          w.classList.remove("correct");
          allCorrect = false;
        }
      });
      isWin = allCorrect;
    } else {
      // Fill Modes
      let allCorrect = true;
      blanks.forEach((b) => {
        const val = b.element.value.trim().toLowerCase();
        const target = b.correct.toLowerCase();
        if (val === target) {
          b.element.classList.add("correct");
          b.element.classList.remove("incorrect");
          correctCount++;
        } else {
          b.element.classList.add("incorrect");
          b.element.classList.remove("correct");
          allCorrect = false;
        }
      });
      isWin = allCorrect;
    }

    if (isWin) {
      soundManager.win();
      messageArea.textContent = "Correct! Well done!";
      messageArea.style.color = "var(--success-color)";

      checkBtn.disabled = true;

      // Auto-advance
      setTimeout(() => {
        messageArea.textContent = "Next sentence coming...";
        setTimeout(() => startNewGame(), 1000);
      }, 2000);
    } else {
      soundManager.wrong();
      messageArea.textContent = "Some errors found. Keep trying!";
      messageArea.style.color = "var(--error-color)";
    }
  }

  function showHintWord() {
    soundManager.click();
    if (currentMode === "sort") return; // No word hint for sort, user sees all

    // Find first empty or incorrect
    const target = blanks.find((b) => {
      const val = b.element.value.trim().toLowerCase();
      return val !== b.correct.toLowerCase();
    });

    if (target) {
      target.element.value = target.correct;
      target.element.classList.add("correct");
      target.element.classList.remove("incorrect");
    }
  }

  function showHintSentence() {
    soundManager.click();
    if (currentMode === "sort") {
      // Sort mode hint: just fix everything? Or one swap?
      // Let's fix everything for simplicity or just show alert
      renderSortMode(currentSentence.split(" ")); // Reset to correct order? No that's cheating.
      // Let's just alert the sentence
      alert(currentSentence);
      return;
    }

    blanks.forEach((b) => {
      b.element.value = b.correct;
      b.element.classList.add("correct");
      b.element.classList.remove("incorrect");
    });
    checkBtn.disabled = true;
    messageArea.textContent = "Sentence Revealed!";
  }

  function resetCurrentGame() {
    soundManager.click();
    renderSentence();
    checkBtn.disabled = false;
  }

  function renderTopicList() {
    topicList.innerHTML = "";
    sentencesData.forEach((topic, index) => {
      const item = document.createElement("div");
      item.className = "topic-item";
      item.innerHTML = `
            <span class="topic-item-title">${topic.title}</span>
            <span class="topic-item-detail">${topic.author || ""} • ${topic.level || ""}</span>
          `;
      item.onclick = () => {
        topicSelect.value = index;
        startNewGame();
        modal.classList.add("hidden");
      };
      topicList.appendChild(item);
    });
  }
});
