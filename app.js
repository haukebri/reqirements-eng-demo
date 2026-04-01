(function () {
  'use strict';

  // === State ===
  const state = {
    currentStep: 0,
    nodeMap: new Map(),
    rootIds: [],
    isProcessing: false,
    conversationFinished: false,
    badgeTimeouts: new Map()
  };

  // === DOM refs ===
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const treePanel = document.getElementById('treePanel');
  const treePanelToggle = document.getElementById('treePanelToggle');
  const treeEmpty = document.getElementById('treeEmpty');
  const treeNodes = document.getElementById('treeNodes');

  // === Init ===
  function init() {
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    treePanelToggle.addEventListener('click', toggleTreePanel);

    prefillInput();
    chatInput.focus();
  }

  function prefillInput() {
    var step = SCENARIO.steps[state.currentStep];
    if (step) {
      chatInput.value = step.suggestedInput;
    }
  }

  // === Chat Engine ===
  function handleSend() {
    if (state.isProcessing) return;

    var text = chatInput.value.trim();
    if (!text) return;

    state.isProcessing = true;
    sendBtn.disabled = true;
    chatInput.value = '';

    appendMessage('user', text);

    var matchedStep = matchStep(text);
    if (matchedStep) {
      playScriptedResponse(matchedStep);
    } else {
      playFallback();
    }
  }

  function matchStep(text) {
    if (state.conversationFinished) return null;

    var step = SCENARIO.steps[state.currentStep];
    if (!step) return null;

    var lower = text.toLowerCase();
    var matched = step.keywords.some(function (kw) {
      return lower.indexOf(kw.toLowerCase()) !== -1;
    });

    return matched ? step : null;
  }

  function playScriptedResponse(step) {
    showTypingIndicator();

    var aiDelay = 800 + Math.random() * 600;
    setTimeout(function () {
      removeTypingIndicator();
      appendMessage('ai', step.aiResponse);

      if (step.architectInterjection) {
        var archDelay = step.architectInterjection.delay || 1500;
        setTimeout(function () {
          showTypingIndicator('architect');
          setTimeout(function () {
            removeTypingIndicator();
            appendMessage('architect', step.architectInterjection.text);
            applyTreeMutations(step.treeMutations);
            advanceStep();
          }, 600);
        }, archDelay);
      } else {
        applyTreeMutations(step.treeMutations);
        advanceStep();
      }
    }, aiDelay);
  }

  function advanceStep() {
    state.currentStep++;
    if (state.currentStep >= SCENARIO.steps.length) {
      state.conversationFinished = true;
      state.isProcessing = false;
      sendBtn.disabled = false;
      chatInput.placeholder = 'Conversation complete — review the feature tree.';
    } else {
      state.isProcessing = false;
      sendBtn.disabled = false;
      prefillInput();
      chatInput.focus();
    }
  }

  function playFallback() {
    showTypingIndicator();

    setTimeout(function () {
      removeTypingIndicator();
      var responses = SCENARIO.fallbackResponses;
      var text = responses[Math.floor(Math.random() * responses.length)];
      appendMessage('ai', text);

      state.isProcessing = false;
      sendBtn.disabled = false;
      prefillInput();
      chatInput.focus();
    }, 900);
  }

  // === Message Rendering ===
  function appendMessage(type, text) {
    var msg = document.createElement('div');
    msg.className = 'message message--' + type;

    var label = document.createElement('div');
    label.className = 'message__label';
    if (type === 'user') label.textContent = 'You';
    else if (type === 'ai') label.textContent = 'AI';
    else if (type === 'architect') label.textContent = 'Architect';

    var bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.textContent = text;

    msg.appendChild(label);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);

    scrollToBottom();
  }

  function showTypingIndicator(type) {
    var existing = chatMessages.querySelector('.typing-message');
    if (existing) existing.remove();

    type = type || 'ai';

    var msg = document.createElement('div');
    msg.className = 'message message--' + type + ' typing-message';

    var label = document.createElement('div');
    label.className = 'message__label';
    label.textContent = type === 'architect' ? 'Architect' : 'AI';

    var bubble = document.createElement('div');
    bubble.className = 'message__bubble';

    var dots = document.createElement('div');
    dots.className = 'typing-indicator';
    dots.innerHTML = '<span></span><span></span><span></span>';

    bubble.appendChild(dots);
    msg.appendChild(label);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);

    scrollToBottom();
  }

  function removeTypingIndicator() {
    var el = chatMessages.querySelector('.typing-message');
    if (el) el.remove();
  }

  function scrollToBottom() {
    var isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 150;
    if (isNearBottom || state.isProcessing) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // === Tree Data ===
  function findNode(id) {
    return state.nodeMap.get(id);
  }

  function addNode(nodeData) {
    var node = {
      id: nodeData.id,
      name: nodeData.name,
      score: nodeData.score || 0,
      badge: nodeData.badge || null,
      parentId: nodeData.parent,
      children: []
    };

    state.nodeMap.set(node.id, node);

    if (node.parentId) {
      var parent = findNode(node.parentId);
      if (parent) {
        parent.children.push(node.id);
      }
    } else {
      state.rootIds.push(node.id);
    }

    return node;
  }

  function removeNode(id) {
    var node = findNode(id);
    if (!node) return;

    // Remove from parent's children
    if (node.parentId) {
      var parent = findNode(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(function (cid) { return cid !== id; });
      }
    } else {
      state.rootIds = state.rootIds.filter(function (rid) { return rid !== id; });
    }

    // Clear badge timeout
    if (state.badgeTimeouts.has(id)) {
      clearTimeout(state.badgeTimeouts.get(id));
      state.badgeTimeouts.delete(id);
    }

    // Remove children recursively
    node.children.forEach(function (cid) { removeNode(cid); });
    state.nodeMap.delete(id);
  }

  // === Tree Mutations ===
  function applyTreeMutations(mutations) {
    if (!mutations || mutations.length === 0) return;

    // Hide empty state
    treeEmpty.style.display = 'none';

    // Split into removes, then other actions
    var removes = mutations.filter(function (m) { return m.action === 'remove'; });
    var others = mutations.filter(function (m) { return m.action !== 'remove'; });

    // Execute removes first (staggered)
    var removeDelay = 0;
    removes.forEach(function (mutation) {
      setTimeout(function () {
        executeMutation(mutation);
      }, removeDelay);
      removeDelay += 150;
    });

    // Then other mutations after removes complete
    var otherStartDelay = removes.length > 0 ? removeDelay + 200 : 0;
    var otherDelay = otherStartDelay;
    others.forEach(function (mutation) {
      setTimeout(function () {
        executeMutation(mutation);
      }, otherDelay);
      otherDelay += 120;
    });
  }

  function executeMutation(mutation) {
    switch (mutation.action) {
      case 'create':
        handleCreate(mutation.node);
        break;
      case 'update':
        handleUpdate(mutation.target, mutation.changes);
        break;
      case 'rename':
        handleRename(mutation.target, mutation.name);
        break;
      case 'remove':
        handleRemove(mutation.target);
        break;
    }
  }

  function handleCreate(nodeData) {
    var node = addNode(nodeData);
    var depth = getDepth(node);
    var el = createNodeElement(node, depth);

    // Find insertion point
    var parentEl = null;
    if (node.parentId) {
      parentEl = treeNodes.querySelector('[data-id="' + node.parentId + '"]');
    }

    if (parentEl) {
      // Insert after parent and all its existing children
      var sibling = parentEl.nextElementSibling;
      while (sibling && parseInt(sibling.dataset.depth) > parseInt(parentEl.dataset.depth)) {
        sibling = sibling.nextElementSibling;
      }
      if (sibling) {
        treeNodes.insertBefore(el, sibling);
      } else {
        treeNodes.appendChild(el);
      }
    } else {
      treeNodes.appendChild(el);
    }

    // Animate in
    el.classList.add('tree-node--entering');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('tree-node--enter-active');
        el.classList.remove('tree-node--entering');
      });
    });

    // Auto-clear badge
    if (node.badge) {
      var timeout = setTimeout(function () {
        node.badge = null;
        var badge = el.querySelector('.tree-node__badge');
        if (badge) {
          badge.style.opacity = '0';
          badge.style.transition = 'opacity 0.3s ease';
          setTimeout(function () { badge.remove(); }, 300);
        }
        state.badgeTimeouts.delete(node.id);
      }, 4000);
      state.badgeTimeouts.set(node.id, timeout);
    }
  }

  function handleUpdate(targetId, changes) {
    var node = findNode(targetId);
    if (!node) return;

    var el = treeNodes.querySelector('[data-id="' + targetId + '"]');
    if (!el) return;

    if (changes.score !== undefined) {
      node.score = changes.score;
      var barFill = el.querySelector('.tree-node__bar-fill');
      var scoreText = el.querySelector('.tree-node__score');
      if (barFill) {
        barFill.style.width = node.score + '%';
        barFill.style.backgroundColor = colorForScore(node.score);
      }
      if (scoreText) {
        scoreText.textContent = node.score + '%';
      }
    }

    if (changes.badge !== undefined) {
      node.badge = changes.badge;
    }

    highlightNode(el);
  }

  function handleRename(targetId, newName) {
    var node = findNode(targetId);
    if (!node) return;

    node.name = newName;
    var el = treeNodes.querySelector('[data-id="' + targetId + '"]');
    if (!el) return;

    var nameEl = el.querySelector('.tree-node__name');
    if (nameEl) nameEl.textContent = newName;

    highlightNode(el);
  }

  function handleRemove(targetId) {
    var el = treeNodes.querySelector('[data-id="' + targetId + '"]');
    if (el) {
      // Also find and remove child elements
      var node = findNode(targetId);
      if (node) {
        node.children.forEach(function (cid) {
          var childEl = treeNodes.querySelector('[data-id="' + cid + '"]');
          if (childEl) {
            childEl.classList.add('tree-node--removing');
          }
        });
      }

      el.classList.add('tree-node--removing');
      setTimeout(function () {
        // Remove child elements
        if (node) {
          node.children.forEach(function (cid) {
            var childEl = treeNodes.querySelector('[data-id="' + cid + '"]');
            if (childEl) childEl.remove();
          });
        }
        el.remove();
        removeNode(targetId);
      }, 350);
    } else {
      removeNode(targetId);
    }
  }

  // === Tree Rendering ===
  function createNodeElement(node, depth) {
    var el = document.createElement('div');
    el.className = 'tree-node';
    el.dataset.id = node.id;
    el.dataset.depth = depth;
    el.style.paddingLeft = (depth * 20 + 12) + 'px';

    // Header row (name + badge)
    var header = document.createElement('div');
    header.className = 'tree-node__header';

    var name = document.createElement('span');
    name.className = 'tree-node__name';
    name.textContent = node.name;
    header.appendChild(name);

    if (node.badge) {
      var badge = document.createElement('span');
      badge.className = 'tree-node__badge badge--pulse';
      badge.textContent = node.badge;
      header.appendChild(badge);
    }

    el.appendChild(header);

    // Bar row (track + score)
    var barRow = document.createElement('div');
    barRow.className = 'tree-node__bar-row';

    var barTrack = document.createElement('div');
    barTrack.className = 'tree-node__bar-track';

    var barFill = document.createElement('div');
    barFill.className = 'tree-node__bar-fill';
    barFill.style.width = '0%';
    barFill.style.backgroundColor = colorForScore(node.score);
    barTrack.appendChild(barFill);
    barRow.appendChild(barTrack);

    var score = document.createElement('span');
    score.className = 'tree-node__score';
    score.textContent = node.score + '%';
    barRow.appendChild(score);

    el.appendChild(barRow);

    // Animate bar fill after insertion
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        barFill.style.width = node.score + '%';
      });
    });

    return el;
  }

  function getDepth(node) {
    var depth = 0;
    var current = node;
    while (current.parentId) {
      depth++;
      current = findNode(current.parentId);
      if (!current) break;
    }
    return depth;
  }

  function colorForScore(score) {
    if (score < 30) return 'var(--color-score-red)';
    if (score < 60) return 'var(--color-score-orange)';
    return 'var(--color-score-green)';
  }

  function highlightNode(el) {
    el.classList.add('tree-node--highlight');
    setTimeout(function () {
      el.classList.remove('tree-node--highlight');
    }, 1200);
  }

  // === Tree Panel Toggle ===
  function toggleTreePanel() {
    treePanel.classList.toggle('collapsed');
  }

  // === Boot ===
  document.addEventListener('DOMContentLoaded', init);
})();
