
  var script = function(tabId) {
        chrome.tabs.executeScript(tabId, {file: "scripts/jquery.js"}, function() { chrome.tabs.executeScript(tabId, {file: "scripts/ui.js"}) });
      },
      regex = /https?:\/\/turntable\.fm\/(?!lobby\/?|static\/?|settings\/?|getfile\/?|down\/?|about\/?|terms\/?|privacy\/?|copyright\/?|jobs\/?).+/i;

  var page = chrome.extension.getBackgroundPage();
  if(page != null) {
    //page.turntable.addEventListener("message", window.tte.ui.listener);
  }

  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    switch(request.api) {
      case 'settings':
        if(request.code == 'get') {
          var a = JSON.parse(localStorage.settings);
          sendResponse(JSON.stringify({settings: a}));
        }
        else
          localStorage.settings = JSON.stringify($.extend(JSON.parse(localStorage.settings), request.settings));
        break;
        
      case 'favorite.add':
        var a = JSON.parse(localStorage.settings);
        if(a.favorites == undefined) a.favorites = [];
        if($.inArray(request.userid, a.favorites) < 0) {
          a.favorites.push(request.userid);
          localStorage.settings = JSON.stringify(a);
        }
        break;
        
      case 'favorite.remove':
        var a = JSON.parse(localStorage.settings),
            pos = $.inArray(request.userid, a.favorites);
        if(a.favorites == undefined) a.favorites = [];
        if(pos >= 0) {
          a.favorites.splice(pos, 1);
          localStorage.settings = JSON.stringify(a);
        }
        break;
        
      case 'set_version':
        var a = JSON.parse(localStorage.settings);
        a.currentVersion = request.version;
        localStorage.settings = JSON.stringify(a);
        break;
        
      case 'notifierKeywords.add':
        var a = JSON.parse(localStorage.settings);
        if(a.notifierKeywords == undefined) a.notifierKeywords = [];
        if($.inArray(request.keyword, a.notifierKeywords) < 0) {
          a.notifierKeywords.push(request.keyword);
          localStorage.settings = JSON.stringify(a);
        }
        break;
        
      case 'notifierKeywords.remove':
        var a = JSON.parse(localStorage.settings),
            pos = $.inArray(request.keyword, a.notifierKeywords);
        if(a.notifierKeywords == undefined) a.notifierKeywords = [];
        if(pos >= 0) {
          a.notifierKeywords.splice(pos, 1);
          localStorage.settings = JSON.stringify(a);
        }
        break;
        
      case 'setNote':
        var a = {};
        if(localStorage.userNotes == undefined || localStorage.userNotes.length <= 0)
          localStorage.userNotes = '';
        else
          a = JSON.parse(localStorage.userNotes);
        a[request.userid] = request.note;          
        localStorage.userNotes = JSON.stringify(a);
        break;
        
      case 'getNote':
        var note = '';
        if(localStorage.userNotes != undefined && localStorage.userNotes.length > 0) {
          var a = JSON.parse(localStorage.userNotes);
          if(a[request.userid] != undefined)
            note = a[request.userid];
        }
        sendResponse(JSON.stringify({ 'note': note }));
        break;
        
      case 'reset':
        localStorage.settings = JSON.stringify(settingsDefault);
        break;
    }
  });
  
  var settingsDefault = {
      notifications: -1,
      separateQueue: true,
      showChatAvatarTooltip: true,
      animations: true,
      favorites: [],
      currentVersion: '',
      notifierKeywords: [],
      displayType: 0
      // 0: 3 columns
      // 1: Queue & Guest List stacked
      // 2: Queue & Chat Stacked
  }

  if(localStorage.settings == undefined || localStorage.settings.length <= 0) {
    localStorage.settings = JSON.stringify(settingsDefault);
  }
  
  chrome.windows.getAll({populate: true}, function(windows) {
    for (var i = 0; i < windows.length; i++) {
      for (var j = 0; j < windows[i].tabs.length; j++) {
        if (regex.test(windows[i].tabs[j].url)) {
          var tabId = windows[i].tabs[j].id;
          script(tabId);
          break;
        }
      }
    }
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete' && regex.test(tab.url)) {
      script(tabId);
    }
  });
