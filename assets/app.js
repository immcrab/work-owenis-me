import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  query,
  orderByChild,
  startAt,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyCDKOIPUhbB5ezjjv2oeDwHYba1kxPVljE",
    authDomain: "owenisme-2e155.firebaseapp.com",
    databaseURL: "https://owenisme-2e155-default-rtdb.firebaseio.com",
    projectId: "owenisme-2e155",
    storageBucket: "owenisme-2e155.firebasestorage.app",
    messagingSenderId: "975653574383",
    appId: "1:975653574383:web:c22386758244673f93ad1a"
  };

  var OFFICIAL_ORDER = ["kiwi", "ghostlink", "lucide", "study"];

  document.getElementById("year").textContent = new Date().getFullYear();

  function getAnonId() {
    try {
      var id = localStorage.getItem("ghostlink_anon_id");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
        localStorage.setItem("ghostlink_anon_id", id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  var OFFICIAL_PASSWORD = "owen123";

  function getMyGames() {
    try {
      return JSON.parse(localStorage.getItem("ghostlink_my_games") || "[]");
    } catch (e) {
      return [];
    }
  }

  function addMyGame(slug) {
    try {
      var mine = getMyGames();
      if (mine.indexOf(slug) === -1) {
        mine.push(slug);
        localStorage.setItem("ghostlink_my_games", JSON.stringify(mine));
      }
    } catch (e) {}
  }

  function removeMyGame(slug) {
    try {
      var mine = getMyGames().filter(function (s) { return s !== slug; });
      localStorage.setItem("ghostlink_my_games", JSON.stringify(mine));
    } catch (e) {}
  }

  var anonId = getAnonId();
  var container = document.getElementById("games");
  var unofficialContainer = document.getElementById("games-unofficial");
  var template = document.getElementById("game-row-template");

  var app = initializeApp(firebaseConfig);
  var db = getDatabase(app);

  function renderRows(rows, myVotes, targetEl) {
    targetEl.innerHTML = "";
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "loading";
      empty.textContent = "nothing here yet.";
      targetEl.appendChild(empty);
      return;
    }
    rows.forEach(function (game) {
      var node = template.content.cloneNode(true);
      var article = node.querySelector(".game");
      article.dataset.slug = game.slug;
      node.querySelector(".game-name").textContent = game.name;
      var descText = game.desc || "";
      if (game.submittedBy) {
        descText = descText ? descText + " — By: " + game.submittedBy : "By: " + game.submittedBy;
      }
      node.querySelector(".game-desc").textContent = descText;
      node.querySelector(".visits-count").textContent = game.visits || 0;

      var likeBtn = node.querySelector(".vote-btn.like");
      var dislikeBtn = node.querySelector(".vote-btn.dislike");
      likeBtn.querySelector(".count").textContent = game.likes || 0;
      dislikeBtn.querySelector(".count").textContent = game.dislikes || 0;

      var myVote = myVotes[game.slug] || 0;
      likeBtn.setAttribute("aria-pressed", myVote === 1);
      dislikeBtn.setAttribute("aria-pressed", myVote === -1);

      function openGame() {
        window.open(game.url, "_blank", "noopener");
        recordVisit(game.slug, article);
      }

      article.addEventListener("click", openGame);
      article.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openGame();
        }
      });

      node.querySelector(".votes").addEventListener("click", function (e) {
        e.stopPropagation();
      });

      likeBtn.addEventListener("click", function () {
        castVote(game.slug, likeBtn, dislikeBtn, 1);
      });
      dislikeBtn.addEventListener("click", function () {
        castVote(game.slug, likeBtn, dislikeBtn, -1);
      });

      if (getMyGames().indexOf(game.slug) !== -1) {
        var ownerActions = node.querySelector(".owner-actions");
        ownerActions.hidden = false;
        ownerActions.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        node.querySelector(".edit-btn").addEventListener("click", function () {
          openEditModal(game);
        });
        node.querySelector(".delete-btn").addEventListener("click", function () {
          if (!confirm("Delete \"" + game.name + "\"?")) return;
          remove(ref(db, "games/" + game.slug)).then(function () {
            removeMyGame(game.slug);
            loadGames();
          });
        });
      }

      targetEl.appendChild(node);
    });
  }

  function recordVisit(slug, article) {
    runTransaction(ref(db, "games/" + slug + "/visits"), function (current) {
      return (current || 0) + 1;
    }).then(function (result) {
      if (result.committed && article) {
        var el = article.querySelector(".visits-count");
        if (el) el.textContent = result.snapshot.val();
      }
    });
  }

  function castVote(slug, likeBtn, dislikeBtn, value) {
    var wasPressed = (value === 1 ? likeBtn : dislikeBtn).getAttribute("aria-pressed") === "true";
    var newVote = wasPressed ? 0 : value;
    var voteRef = ref(db, "votes/" + anonId + "/" + slug);

    likeBtn.disabled = true;
    dislikeBtn.disabled = true;

    get(voteRef).then(function (snap) {
      var oldVote = snap.exists() ? snap.val() : 0;
      return runTransaction(ref(db, "games/" + slug), function (game) {
        if (!game) return game;
        game.likes = game.likes || 0;
        game.dislikes = game.dislikes || 0;
        if (oldVote === 1) game.likes -= 1;
        if (oldVote === -1) game.dislikes -= 1;
        if (newVote === 1) game.likes += 1;
        if (newVote === -1) game.dislikes += 1;
        return game;
      }).then(function (result) {
        return (newVote === 0 ? remove(voteRef) : set(voteRef, newVote)).then(function () {
          return result;
        });
      });
    }).then(function (result) {
      if (result && result.committed) {
        var game = result.snapshot.val();
        likeBtn.querySelector(".count").textContent = game.likes || 0;
        dislikeBtn.querySelector(".count").textContent = game.dislikes || 0;
        likeBtn.setAttribute("aria-pressed", newVote === 1);
        dislikeBtn.setAttribute("aria-pressed", newVote === -1);
      }
    }).finally(function () {
      likeBtn.disabled = false;
      dislikeBtn.disabled = false;
    });
  }

  function loadGames() {
    get(ref(db, "games")).then(function (snap) {
      var all = snap.val() || {};
      var officialRows = [];
      var unofficialRows = [];

      Object.keys(all).forEach(function (slug) {
        var row = all[slug];
        var game = {
          slug: slug,
          name: row.name,
          desc: row.description || "",
          url: row.url,
          submittedBy: row.submittedBy || "",
          createdAt: row.createdAt || 0,
          visits: row.visits || 0,
          likes: row.likes || 0,
          dislikes: row.dislikes || 0
        };
        if (row.category === "Official") {
          officialRows.push(game);
        } else if (row.category === "Unofficial" && row.status === "approved") {
          unofficialRows.push(game);
        }
      });

      function officialSortIndex(slug) {
        var i = OFFICIAL_ORDER.indexOf(slug);
        return i === -1 ? Infinity : i;
      }
      officialRows.sort(function (a, b) {
        var diff = officialSortIndex(a.slug) - officialSortIndex(b.slug);
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      });
      unofficialRows.sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });

      get(ref(db, "votes/" + anonId)).then(function (voteSnap) {
        var myVotes = voteSnap.val() || {};
        renderRows(officialRows, myVotes, container);
        renderRows(unofficialRows, myVotes, unofficialContainer);
      });
    });
  }

  var SUBMIT_RATE_LIMIT = 5;

  function slugify(name) {
    var s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    return s || "game";
  }

  function findFreeSlug(baseSlug) {
    function tryNext(candidate, attempt) {
      return get(ref(db, "games/" + candidate)).then(function (snap) {
        if (!snap.exists()) return candidate;
        if (attempt > 50) throw new Error("no_free_slug");
        return tryNext(baseSlug + "-" + attempt, attempt + 1);
      });
    }
    return tryNext(baseSlug, 2);
  }

  function initSubmitModal() {
    var openBtn = document.getElementById("submit-open-btn");
    var closeBtn = document.getElementById("submit-close-btn");
    var overlay = document.getElementById("submit-modal-overlay");
    var form = document.getElementById("submit-form");
    var status = document.getElementById("submit-status");
    if (!openBtn || !overlay || !form) return;

    function openModal() {
      overlay.hidden = false;
      status.textContent = "";
      document.getElementById("submit-name").focus();
    }

    function closeModal() {
      overlay.hidden = true;
    }

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeModal();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = document.getElementById("submit-name").value.trim().slice(0, 60);
      var url = document.getElementById("submit-url").value.trim().slice(0, 500);
      var desc = document.getElementById("submit-desc").value.trim().slice(0, 140);
      var username = document.getElementById("submit-username").value.trim().slice(0, 30);
      var btn = document.getElementById("submit-btn");

      if (!name) {
        status.textContent = "Give it a name.";
        return;
      }
      if (!/^https?:\/\/\S+$/i.test(url)) {
        status.textContent = "That doesn't look like a valid link (needs http:// or https://).";
        return;
      }

      btn.disabled = true;
      status.textContent = "Submitting…";

      var since = Date.now() - 24 * 60 * 60 * 1000;
      var recentQuery = query(ref(db, "submissions/" + anonId), orderByChild("createdAt"), startAt(since));

      get(recentQuery)
        .then(function (recentSnap) {
          if (recentSnap.size >= SUBMIT_RATE_LIMIT) {
            throw new Error("rate_limited");
          }
          return findFreeSlug(slugify(name));
        })
        .then(function (slug) {
          var isOfficial = username === OFFICIAL_PASSWORD;
          return set(ref(db, "games/" + slug), {
            name: name,
            description: desc || null,
            url: url,
            category: isOfficial ? "Official" : "Unofficial",
            status: "approved",
            submittedBy: username || null,
            visits: 0,
            likes: 0,
            dislikes: 0,
            createdAt: serverTimestamp()
          }).then(function () {
            addMyGame(slug);
            return push(ref(db, "submissions/" + anonId), {
              url: url,
              slug: slug,
              createdAt: serverTimestamp()
            });
          }).then(function () {
            return isOfficial;
          });
        })
        .then(function (isOfficial) {
          status.textContent = isOfficial
            ? "Added! Showing up under Official now."
            : "Added! Showing up under Unofficial now.";
          form.reset();
          loadGames();
        })
        .catch(function (err) {
          if (err && err.message === "rate_limited") {
            status.textContent = "That's enough submissions for one day — try again tomorrow.";
          } else {
            status.textContent = "Something went wrong. Try again later.";
          }
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  var editingSlug = null;

  function openEditModal(game) {
    editingSlug = game.slug;
    document.getElementById("edit-status").textContent = "";
    document.getElementById("edit-name").value = game.name || "";
    document.getElementById("edit-url").value = game.url || "";
    document.getElementById("edit-desc").value = game.desc || "";
    document.getElementById("edit-modal-overlay").hidden = false;
    document.getElementById("edit-name").focus();
  }

  function initEditModal() {
    var closeBtn = document.getElementById("edit-close-btn");
    var overlay = document.getElementById("edit-modal-overlay");
    var form = document.getElementById("edit-form");
    var status = document.getElementById("edit-status");
    if (!overlay || !form) return;

    function closeModal() {
      overlay.hidden = true;
      editingSlug = null;
    }

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeModal();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!editingSlug) return;

      var name = document.getElementById("edit-name").value.trim().slice(0, 60);
      var url = document.getElementById("edit-url").value.trim().slice(0, 500);
      var desc = document.getElementById("edit-desc").value.trim().slice(0, 140);
      var btn = document.getElementById("edit-save-btn");

      if (!name) {
        status.textContent = "Give it a name.";
        return;
      }
      if (!/^https?:\/\/\S+$/i.test(url)) {
        status.textContent = "That doesn't look like a valid link (needs http:// or https://).";
        return;
      }

      btn.disabled = true;
      status.textContent = "Saving…";

      update(ref(db, "games/" + editingSlug), {
        name: name,
        description: desc || null,
        url: url
      }).then(function () {
        closeModal();
        loadGames();
      }).catch(function () {
        status.textContent = "Something went wrong. Try again later.";
      }).finally(function () {
        btn.disabled = false;
      });
    });
  }

  loadGames();
  initSubmitModal();
  initEditModal();
})();
