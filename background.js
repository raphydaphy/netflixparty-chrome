'use strict';

// log events
function logEvent(eventType) {
  var numTries = 0;
  var permId, recentlyUpdated;
  var logEventInterval = setInterval(function() {
    try {
      if(numTries > 5) {
        clearInterval(logEventInterval);
      }

      chrome.storage.local.get(null, function(data) {
        if(data.userId) {
          permId = data.userId;
        }
        if(data.recentlyUpdated) {
          recentlyUpdated = data.recentlyUpdated;
        }
      });

      // only send events if recent update
      if(permId && recentlyUpdated) {
        var data = {
          userId: permId,
          eventType: eventType,
        }

        console.debug("event: " + JSON.stringify(data));

        var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance 
        xmlhttp.open("POST", "https://netflixparty.raphydaphy.com/log-event");
        xmlhttp.setRequestHeader("Content-Type", "application/json");
        xmlhttp.send(JSON.stringify(data));
        
        clearInterval(logEventInterval);
      } else {
        numTries = numTries + 1;
      }   
    } catch (e) {
      console.log("log event error");
    }
  }, 5000);
}

/********************
 * Chrome Listeners *
 ********************/

chrome.storage.onChanged.addListener(function(changes, areaName) {
  console.debug("storage change: " + JSON.stringify(changes) + " for " + JSON.stringify(areaName));
});

const urlRegex = RegExp("netflix\.com");

chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
  if (info.status == "complete" && urlRegex.test(tab.url)) {
    chrome.tabs.executeScript(tabId, {
      file: "main.js"
    }, () => {
      try {
        chrome.tabs.sendMessage(tabId, {
          type: "urlChanged",
          data: {
            url: tab.url
          }
        }, (response) => {});
      } catch(err) {}
    });
  }
});

/***********************
 * User Authentication *
 ***********************/

function createUser(name) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      var response = JSON.parse(xhr.responseText);

      if (response.id) {
        chrome.storage.local.set({
          userId: response.id,
          userToken: response.token,
          recentlyUpdated: true
        }, function() {
          console.log('Successfully created and cached user account!');
        });
      } else {
        console.warn("Recieved invalid response when creating user", response)
      }
    }
  }
  xhr.open("POST", "https://netflixparty.raphydaphy.com/create-user", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({name: name}));
}

function validateToken(id, token, fn) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      var response = JSON.parse(xhr.responseText);
      fn(response.result);
    }
  }
  xhr.open("POST", "https://netflixparty.raphydaphy.com/validate-token", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({
    userid: id,
    token: token
  }));
}

try {
  function createUserFromEmail() {
    chrome.identity.getProfileUserInfo(function(info) {
      var name = undefined;
      if (info.email) name = info.email.split("@")[0];
      createUser(name);
    });
    
  }

  chrome.storage.local.get(null, function(data) {
    if(!data.userId) {
      console.debug("Attempting to create user account...")
      createUserFromEmail();
    } else {
      validateToken(data.userId, data.userToken, result => {
        if (result != "success") {
          console.info("Token has expired. Attempting to create a new account...");
          createUserFromEmail();
        } else {
          console.debug("Token is valid.");
        }
      });
    }
  });
} catch(e) {
  console.warn("User auth error", e);
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.debug(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");
    if (request.summary) {
      var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance 
      xmlhttp.open("POST", "https://netflixparty.raphydaphy.com/log-summary", true);
      xmlhttp.setRequestHeader("Content-Type", "application/json");
      xmlhttp.send(JSON.stringify(request.summary));

      sendResponse({farewell: "goodbye"});
    }
  }
);

/********************
 * Background Logic *
 ********************/

// only load for URLs that match www.netflix.com/watch/*
chrome.runtime.onInstalled.addListener(function(details) {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostContains: '.netflix.',
            pathPrefix: '/watch/',
            schemes: ['http', 'https']
          }
        })
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});