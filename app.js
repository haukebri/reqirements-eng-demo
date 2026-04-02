(function () {
  'use strict';

  // In production (served by Express), use relative path. In dev (port 3000/5500 or file://), fall back to explicit backend URL.
  var DEV_PORTS = ['3000', '5500'];
  var API_BASE = window.location.protocol === 'file:' || DEV_PORTS.indexOf(window.location.port) !== -1
    ? 'http://localhost:3001/api'
    : window.location.origin + '/api';

  // === State ===
  var state = {
    sessionId: null,
    nodeMap: new Map(),
    rootIds: [],
    isProcessing: false,
    knowledgeMap: new Map(),
    expandedNodes: new Set()
  };

  // === DOM refs ===
  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var sendBtn = document.getElementById('sendBtn');
  var treePanel = document.getElementById('treePanel');
  var treePanelToggle = document.getElementById('treePanelToggle');
  var treeEmpty = document.getElementById('treeEmpty');
  var treeNodes = document.getElementById('treeNodes');

  // === Init ===
  async function init() {
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    treePanelToggle.addEventListener('click', toggleTreePanel);

    try {
      var res = await fetch(API_BASE + '/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'RequirementsAI Session' })
      });
      var session = await res.json();
      state.sessionId = session.id;
    } catch (e) {
      console.error('Failed to create session:', e);
    }

    chatInput.focus();
  }

  // === Chat Engine ===
  async function handleSend() {
    if (state.isProcessing || !state.sessionId) return;

    var text = chatInput.value.trim();
    if (!text) return;

    state.isProcessing = true;
    sendBtn.disabled = true;
    chatInput.value = '';

    appendMessage('user', text);
    showTypingIndicator('ai');

    var maxRetries = 3;
    var retryDelay = 1000;

    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(function (resolve) { setTimeout(resolve, retryDelay); });
        retryDelay *= 2;
        showTypingIndicator('ai');
      }

      var networkError = false;

      try {
        var response = await fetch(API_BASE + '/sessions/' + state.sessionId + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
          removeTypingIndicator();
          var errMsg = response.status === 503
            ? 'AI service is unavailable. Please check the server configuration.'
            : 'Sorry, something went wrong. Please try again.';
          appendMessage('ai', errMsg);
          break; // non-retryable HTTP error
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var aiMessageBubble = null;
        var aiMessageText = '';
        var eventType = null;
        var sseError = false;

        while (true) {
          var result = await reader.read();
          if (result.done) break;

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line in buffer

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              var data = JSON.parse(line.slice(6));
              if (eventType === 'message_chunk') {
                if (!aiMessageBubble) {
                  removeTypingIndicator();
                  aiMessageBubble = createStreamingMessageBubble();
                }
                aiMessageText += data.text;
                aiMessageBubble.textContent = aiMessageText;
                scrollToBottom();
              } else if (eventType === 'tree_mutation') {
                treeEmpty.style.display = 'none';
                executeMutation(data);
              } else if (eventType === 'knowledge_item') {
                handleAddItems(data.nodeId, [data.item]);
              } else if (eventType === 'error') {
                removeTypingIndicator();
                appendMessage('ai', 'Error: ' + (data.message || 'Something went wrong. Please try again.'));
                sseError = true;
              }
              // 'done' event requires no action
              eventType = null;
            }
            if (sseError) break;
          }
          if (sseError) break;
        }

        // If no chunks were received, remove dangling typing indicator
        if (!aiMessageBubble && !sseError) {
          removeTypingIndicator();
        }
      } catch (e) {
        networkError = true;
        console.error('Chat error (attempt ' + (attempt + 1) + '):', e);
        removeTypingIndicator();
        if (attempt < maxRetries) {
          appendMessage('ai', 'Connection lost. Reconnecting... (' + (attempt + 1) + '/' + maxRetries + ')');
        } else {
          appendMessage('ai', 'Connection failed after ' + maxRetries + ' retries. Please try again.');
        }
      }

      if (!networkError) break; // success, HTTP error, or SSE error — do not retry
    }

    state.isProcessing = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }

  function createStreamingMessageBubble() {
    var msg = document.createElement('div');
    msg.className = 'message message--ai';

    var label = document.createElement('div');
    label.className = 'message__label';
    label.textContent = 'AI';

    var bubble = document.createElement('div');
    bubble.className = 'message__bubble';

    msg.appendChild(label);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    scrollToBottom();

    return bubble;
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

    if (node.parentId) {
      var parent = findNode(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(function (cid) { return cid !== id; });
      }
    } else {
      state.rootIds = state.rootIds.filter(function (rid) { return rid !== id; });
    }

    state.knowledgeMap.delete(id);
    state.expandedNodes.delete(id);

    node.children.forEach(function (cid) { removeNode(cid); });
    state.nodeMap.delete(id);
  }

  // === Tree Mutations ===
  function applyTreeMutations(mutations) {
    if (!mutations || mutations.length === 0) return;

    treeEmpty.style.display = 'none';

    var removes = mutations.filter(function (m) { return m.action === 'remove'; });
    var transition = mutations.filter(function (m) { return m.action === 'transition'; })[0] || null;
    var others = mutations.filter(function (m) { return m.action !== 'remove' && m.action !== 'transition'; });

    var removeDelay = 0;
    removes.forEach(function (mutation) {
      setTimeout(function () {
        executeMutation(mutation);
      }, removeDelay);
      removeDelay += 150;
    });

    var transitionDuration = 0;
    if (transition) {
      transitionDuration = transition.duration || 2500;
      var transitionStart = removes.length > 0 ? removeDelay + 400 : 0;
      setTimeout(function () {
        showTreeTransition(transition.text || 'Restructuring...');
      }, transitionStart);
      setTimeout(function () {
        hideTreeTransition();
      }, transitionStart + transitionDuration);
    }

    var otherStartDelay = removes.length > 0 ? removeDelay + 200 : 0;
    if (transition) {
      otherStartDelay = (removes.length > 0 ? removeDelay + 400 : 0) + transitionDuration + 200;
    }
    var otherDelay = otherStartDelay;
    others.forEach(function (mutation) {
      setTimeout(function () {
        executeMutation(mutation);
      }, otherDelay);
      otherDelay += 200;
    });
  }

  // === Tree Transition Overlay ===
  function showTreeTransition(text) {
    var existing = treeNodes.parentElement.querySelector('.tree-transition');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'tree-transition';

    var spinner = document.createElement('div');
    spinner.className = 'tree-transition__spinner';

    var label = document.createElement('div');
    label.className = 'tree-transition__text';
    label.textContent = text;

    overlay.appendChild(spinner);
    overlay.appendChild(label);
    treeNodes.parentElement.appendChild(overlay);
  }

  function hideTreeTransition() {
    var overlay = treeNodes.parentElement.querySelector('.tree-transition');
    if (overlay) {
      overlay.classList.add('tree-transition--fading');
      setTimeout(function () { overlay.remove(); }, 400);
    }
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
      case 'addItems':
        handleAddItems(mutation.target, mutation.items);
        break;
      case 'resolveItem':
        handleResolveItem(mutation.target, mutation.itemId);
        break;
    }
  }

  // === Knowledge Item Mutations ===
  function handleAddItems(targetId, items) {
    if (!state.knowledgeMap.has(targetId)) {
      state.knowledgeMap.set(targetId, []);
    }
    var arr = state.knowledgeMap.get(targetId);
    items.forEach(function (item) { arr.push(item); });

    var el = treeNodes.querySelector('[data-id="' + targetId + '"]');
    if (!el) return;

    if (state.expandedNodes.has(targetId)) {
      var itemsContainer = el.querySelector('.tree-node__items');
      if (itemsContainer) {
        items.forEach(function (item) {
          var kiEl = renderKnowledgeItem(item);
          kiEl.classList.add('ki--new');
          itemsContainer.appendChild(kiEl);
          setTimeout(function () {
            kiEl.classList.remove('ki--new');
          }, 1500);
        });
      }
    }

    updateNodeBadge(targetId);
  }

  function handleResolveItem(targetId, itemId) {
    var items = state.knowledgeMap.get(targetId);
    if (!items) return;

    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId) {
        items[i].resolved = true;
        break;
      }
    }

    var el = treeNodes.querySelector('[data-id="' + targetId + '"]');
    if (el) {
      var kiEl = el.querySelector('[data-ki-id="' + itemId + '"]');
      if (kiEl) {
        kiEl.classList.add('ki--resolved');
      }
    }

    updateNodeBadge(targetId);
  }

  // === Knowledge Item Rendering ===
  function renderKnowledgeItem(item) {
    var iconMap = {
      fakt: '●',
      frage: '?',
      inferenz: '◌',
      widerspruch: '⚠'
    };

    var el = document.createElement('div');
    el.className = 'ki ki--' + item.type;
    el.dataset.kiId = item.id;

    if (item.resolved) {
      el.classList.add('ki--resolved');
    }

    var icon = document.createElement('span');
    icon.className = 'ki__icon';
    icon.textContent = iconMap[item.type] || '●';

    var source = document.createElement('span');
    source.className = 'ki__source';
    source.textContent = '(' + item.source + ')';

    var text = document.createElement('span');
    text.className = 'ki__text';
    text.textContent = item.text;

    el.appendChild(icon);
    el.appendChild(source);
    el.appendChild(text);

    return el;
  }

  function renderCountBadge(nodeId) {
    var items = state.knowledgeMap.get(nodeId) || [];
    var facts = 0;
    var questions = 0;
    var inferences = 0;
    var contradictions = 0;

    items.forEach(function (item) {
      if (item.type === 'fakt') facts++;
      else if (item.type === 'frage' && !item.resolved) questions++;
      else if (item.type === 'inferenz') inferences++;
      else if (item.type === 'widerspruch') contradictions++;
    });

    var parts = [];
    if (facts > 0) parts.push(facts + '●');
    if (questions > 0) parts.push(questions + '?');
    if (inferences > 0) parts.push(inferences + '◌');
    if (contradictions > 0) parts.push(contradictions + '⚠');

    return parts.join(' ');
  }

  function updateNodeBadge(nodeId) {
    var el = treeNodes.querySelector('[data-id="' + nodeId + '"]');
    if (!el) return;

    var header = el.querySelector('.tree-node__header');
    if (!header) return;

    var badge = header.querySelector('.tree-node__count-badge');
    var badgeText = renderCountBadge(nodeId);

    if (!badgeText) {
      if (badge) badge.style.display = 'none';
      return;
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tree-node__count-badge';
      header.appendChild(badge);
    }

    badge.textContent = badgeText;
    badge.style.display = '';
  }

  // === Tree Mutation Handlers ===
  function handleCreate(nodeData) {
    var node = addNode(nodeData);
    var depth = getDepth(node);
    var el = createNodeElement(node, depth);

    state.knowledgeMap.set(node.id, []);

    var parentEl = null;
    if (node.parentId) {
      parentEl = treeNodes.querySelector('[data-id="' + node.parentId + '"]');
    }

    if (parentEl) {
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

    el.classList.add('tree-node--entering');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('tree-node--enter-active');
        el.classList.remove('tree-node--entering');
      });
    });
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
        if (node) {
          node.children.forEach(function (cid) {
            var childEl = treeNodes.querySelector('[data-id="' + cid + '"]');
            if (childEl) childEl.remove();
          });
        }
        el.remove();
        removeNode(targetId);
        if (state.rootIds.length === 0) {
          treeEmpty.style.display = '';
        }
      }, 350);
    } else {
      removeNode(targetId);
      if (state.rootIds.length === 0) {
        treeEmpty.style.display = '';
      }
    }
  }

  // === Tree Rendering ===
  function createNodeElement(node, depth) {
    var el = document.createElement('div');
    el.className = 'tree-node';
    el.dataset.id = node.id;
    el.dataset.depth = depth;
    el.style.paddingLeft = (depth * 20 + 12) + 'px';

    var header = document.createElement('div');
    header.className = 'tree-node__header';

    var toggle = document.createElement('span');
    toggle.className = 'tree-node__toggle';
    toggle.textContent = '▶';
    header.appendChild(toggle);

    var name = document.createElement('span');
    name.className = 'tree-node__name';
    name.textContent = node.name;
    header.appendChild(name);

    var countBadge = document.createElement('span');
    countBadge.className = 'tree-node__count-badge';
    countBadge.style.display = 'none';
    header.appendChild(countBadge);

    header.addEventListener('click', function () {
      toggleNodeExpand(node.id, el);
    });

    el.appendChild(header);

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

    var itemsContainer = document.createElement('div');
    itemsContainer.className = 'tree-node__items';
    itemsContainer.style.display = 'none';
    el.appendChild(itemsContainer);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        barFill.style.width = node.score + '%';
      });
    });

    return el;
  }

  function toggleNodeExpand(nodeId, el) {
    if (state.expandedNodes.has(nodeId)) {
      state.expandedNodes.delete(nodeId);
      el.classList.remove('tree-node--expanded');
      var itemsContainer = el.querySelector('.tree-node__items');
      if (itemsContainer) {
        itemsContainer.style.display = 'none';
      }
    } else {
      state.expandedNodes.add(nodeId);
      el.classList.add('tree-node--expanded');
      var itemsContainer = el.querySelector('.tree-node__items');
      if (itemsContainer) {
        itemsContainer.innerHTML = '';
        var items = state.knowledgeMap.get(nodeId) || [];
        items.forEach(function (item) {
          itemsContainer.appendChild(renderKnowledgeItem(item));
        });
        itemsContainer.style.display = 'block';
      }
    }
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
