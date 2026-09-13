(function () {
  "use strict";

  // Filled in after the Supabase project + schema are provisioned.
  var SUPABASE_URL = "https://qlehylbpigveqtcmidfm.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_ZjrSrwp1x9_Gh0iLMXdQKQ_oNgLU8jA";

  var GAMES = [
    { slug: "kiwi", name: "Kiwi", desc: "a game site, one click away", url: "https://kiwi.pxplay.top" },
    { slug: "ghostlink", name: "Ghostlink", desc: "a curated hub of games and links", url: "https://ghostlink.pxplay.top/" },
    { slug: "lucide", name: "Lucide", desc: "a game, one click away", url: "https://s3.amazonaws.com/lucidestatic/index.html" },
    { slug: "study", name: "Study", desc: "a study guide, one click away", url: "https://s3.amazonaws.com/aphistory/study.html" }
  ];

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

  var anonId = getAnonId();
  var container = document.getElementById("games");
  var unofficialContainer = document.getElementById("games-unofficial");
  var template = document.getElementById("game-row-template");
  var configured = SUPABASE_URL.indexOf("__") !== 0;
  var supabase = configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

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
      node.querySelector(".game-desc").textContent = game.desc;
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

      targetEl.appendChild(node);
    });
  }

  function recordVisit(slug, article) {
    if (!supabase) return;
    supabase.rpc("record_visit", { p_slug: slug }).then(function (res) {
      if (res.data && res.data.length && article) {
        var el = article.querySelector(".visits-count");
        if (el) el.textContent = res.data[0].visits;
      }
    });
  }

  function castVote(slug, likeBtn, dislikeBtn, value) {
    if (!supabase) return;
    var wasPressed = (value === 1 ? likeBtn : dislikeBtn).getAttribute("aria-pressed") === "true";
    var newVote = wasPressed ? 0 : value;

    likeBtn.disabled = true;
    dislikeBtn.disabled = true;

    supabase.rpc("cast_vote", { p_slug: slug, p_anon_id: anonId, p_vote: newVote })
      .then(function (res) {
        if (res.data && res.data.length) {
          var row = res.data[0];
          likeBtn.querySelector(".count").textContent = row.likes;
          dislikeBtn.querySelector(".count").textContent = row.dislikes;
          likeBtn.setAttribute("aria-pressed", row.my_vote === 1);
          dislikeBtn.setAttribute("aria-pressed", row.my_vote === -1);
        }
      })
      .finally(function () {
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
      });
  }

  function loadGames() {
    if (!supabase) {
      var offlineRows = GAMES.map(function (g) { return Object.assign({}, g, { visits: 0, likes: 0, dislikes: 0 }); });
      renderRows(offlineRows, {}, container);
      renderRows([], {}, unofficialContainer);
      return;
    }

    supabase.from("games").select("slug,name,description,url,category,status,visits,likes,dislikes").then(function (res) {
      var rows = res.data || [];
      var bySlug = {};
      rows.forEach(function (row) { bySlug[row.slug] = row; });

      var officialRows = GAMES.map(function (g) {
        var row = bySlug[g.slug] || {};
        return {
          slug: g.slug,
          name: g.name,
          desc: g.desc,
          url: g.url,
          visits: row.visits || 0,
          likes: row.likes || 0,
          dislikes: row.dislikes || 0
        };
      });

      var officialSlugs = {};
      GAMES.forEach(function (g) { officialSlugs[g.slug] = true; });

      var unofficialRows = rows
        .filter(function (row) { return row.category === "Unofficial" && row.status === "approved" && !officialSlugs[row.slug]; })
        .map(function (row) {
          return {
            slug: row.slug,
            name: row.name,
            desc: row.description || "",
            url: row.url,
            visits: row.visits || 0,
            likes: row.likes || 0,
            dislikes: row.dislikes || 0
          };
        });

      supabase.rpc("get_my_votes", { p_anon_id: anonId }).then(function (voteRes) {
        var myVotes = {};
        (voteRes.data || []).forEach(function (v) { myVotes[v.game_slug] = v.vote; });
        renderRows(officialRows, myVotes, container);
        renderRows(unofficialRows, myVotes, unofficialContainer);
      });
    });
  }

  var SUBMIT_ERROR_MESSAGES = {
    invalid_name: "Give it a name.",
    invalid_url: "That doesn't look like a valid link (needs http:// or https://).",
    invalid_anon: "Couldn't identify this browser — try reloading the page.",
    rate_limited: "That's enough submissions for one day — try again tomorrow."
  };

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
      if (!supabase) {
        status.textContent = "Submissions need the backend configured.";
        return;
      }

      var name = document.getElementById("submit-name").value.trim();
      var url = document.getElementById("submit-url").value.trim();
      var desc = document.getElementById("submit-desc").value.trim();
      var btn = document.getElementById("submit-btn");

      btn.disabled = true;
      status.textContent = "Submitting…";

      supabase.rpc("submit_game", { p_name: name, p_url: url, p_desc: desc || null, p_anon_id: anonId })
        .then(function (res) {
          if (res.error) {
            var key = (res.error.message || "").trim();
            status.textContent = SUBMIT_ERROR_MESSAGES[key] || "Something went wrong. Try again later.";
            return;
          }
          status.textContent = "Added! Showing up under Unofficial now.";
          form.reset();
          loadGames();
        })
        .catch(function () {
          status.textContent = "Something went wrong. Try again later.";
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  loadGames();
  initSubmitModal();
})();
