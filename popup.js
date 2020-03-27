var userId;
var userToken;

chrome.storage.local.get(null, function(data) {
  userId = data.userId;
  userToken = data.userToken;
});

var getURLParameter = function(url, key) {
  var searchString = '?' + url.split('?')[1];
  if (searchString === undefined) {
    return null;
  }
  var escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  var regex = new RegExp('[?|&]' + escapedKey + '=' + '([^&]*)(&|$)');
  var match = regex.exec(searchString);
  if (match === null) {
    return null;
  }
  return decodeURIComponent(match[1]);
};

chrome.tabs.query({
  active: true,
  currentWindow: true
}, tabs => {
  var tab = tabs[0];
  var contentScript = "main.js";

  // error handling
  function showErr(err) {
    jQuery(".some-error").removeClass("hidden");
    jQuery(".no-error").addClass("hidden");
    jQuery("#error-msg").html(err);
  };

  jQuery("#close-error").click(function() {
    jQuery(".no-error").removeClass("hidden");
    jQuery(".some-error").addClass("hidden");
  });

  // set up the spinner
  function startSpinning() {
    jQuery("#control-lock").prop("disabled", true);
    jQuery("#create-session").prop("disabled", true);
    jQuery("#leave-session").prop("disabled", true);
  };

  function stopSpinning() {
    jQuery("#control-lock").prop("disabled", false);
    jQuery("#create-session").prop("disabled", false);
    jQuery("#leave-session").prop("disabled", false);
  };

  function sendMessage(type, data, callback) {
    startSpinning();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: type,
        data: data
      }, function(response) {
        stopSpinning();
        console.log("Got response for " + type, response);
        if (response.errorMessage) return showError(response.errorMessage);
        if (callback) callback(response);
      });
    });
  }

  // connected/disconnected state
  var showConnected = function(sessionId) {
    var urlWithSessionId = tab.url.split("?")[0] + "?npSessionId=" + encodeURIComponent(sessionId);

    $(".disconnected").addClass("hidden");
    $(".connected").removeClass("hidden");
    $("#show-chat").prop("checked", true);
    $("#share-url").val(urlWithSessionId) .focus().select();
  };

  var showDisconnected = function() {
    $(".disconnected").removeClass("hidden");
    $(".connected").addClass("hidden");
    $("#control-lock").prop("checked", false);
  };

  // get the session if there is one
  sendMessage("getInitData", {
    version: chrome.app.getDetails().version
  }, function(initData) {
    // parse the video ID from the URL
    var videoId = parseInt(tab.url.match(/^.*\/([0-9]+)\??.*/)[1]);
    var videoDomId = null;

    if(initData.videoDomId) {
      videoDomId = initData.videoDomId;
    }


    // initial state
    if (initData.errorMessage) {
      showError(initData.errorMessage);
      return;
    }
    if (initData.sessionId === null) {
      var sessionIdFromUrl = getURLParameter(tab.url, "npSessionId");
      if (sessionIdFromUrl) {
        sendMessage("joinSession", {
          sessionId: sessionIdFromUrl.replace(/^\s+|\s+$/g, "").toLowerCase(),
          videoId: videoId
        }, function(response) {
          showConnected(sessionIdFromUrl);
        });
      }
    } else {
      showConnected(initData.sessionId);
    }

    $("#show-chat").prop("checked", initData.chatVisible);

    // listen for clicks on the "Create session" button
    $("#create-session").click(function() {
      sendMessage("createSession", {
        controlLock: $("#control-lock").is(":checked"),
        videoId: videoId
      }, function(response) {
        showConnected(response.sessionId);
      });
    });

    // listen for clicks on the "Leave session" button
    $("#leave-session").click(function() {
      sendMessage("leaveSession", {}, function(response) {
        showDisconnected();
      });
    });

    // listen for clicks on the "Show chat" checkbox
    $("#show-chat").change(function() {
      sendMessage("showChat", { visible: $("#show-chat").is(":checked") }, null);
    });

    // listen for clicks on the share URL box
    $("#share-url").click(function(e) {
      var sessionIdFromShareUrl = getURLParameter($("#share-url").val(), "npSessionId", 1);
      var defaultServerFromShareUrl = getURLParameter($("#share-url").val(), "npServerId", 1);
      if(sessionIdFromShareUrl) showConnected(sessionIdFromShareUrl, defaultServerFromShareUrl);

      e.stopPropagation();
      e.preventDefault();
      $("#share-url").select();
    });

    // listen for clicks on the "Copy URL" link
    $("#copy-btn").click(function(e) {
      console.log("click");
      var sessionIdFromShareUrl = getURLParameter($("#share-url").val(), "npSessionId", 1);
      var defaultServerFromShareUrl = getURLParameter($("#share-url").val(), "npServerId", 1);
      if(sessionIdFromShareUrl) showConnected(sessionIdFromShareUrl, defaultServerFromShareUrl);
      e.stopPropagation();
      e.preventDefault();
      $("#share-url").select();
      document.execCommand("copy");
    });
  });
});