$('[id*="tteui"]').remove();
$('body').append('<div id="tteui-msg" style="display: none;"></div>');
$('#tteui-msg').bind('tteEventWeb', function() {
  var data = JSON.parse($(this).html());
  var msgId = data.msgId;
  console.log('Received from web: ');
  console.log(data);
  switch(data.api) {
    case 'settings':
      if(data.code == 'get') {
        chrome.extension.sendRequest({api: 'settings', code: 'get'}, function(response) {
          var res = JSON.parse(response);
          switchDisplay(res.settings.displayType);
          window.sendData($.extend({'msgId': msgId}, res));
        });
      }
      else {
        if(data.settings.displayType != undefined)
          switchDisplay(data.settings.displayType);
        chrome.extension.sendRequest(data);
      }
      break;
      
    default:
      chrome.extension.sendRequest(data, function(response) {
        if(response != undefined && response.length > 0) {
          var res = JSON.parse(response);
          window.sendData($.extend({'msgId': msgId}, res));
        }
      });
  }
});

var switchDisplay = function(type) {
  if(type == undefined) type = 0;
  $('#tteui').remove();
  switch(type) {
    case -1:
      break;

    case 1:
      script = document.createElement('link');
      script.type = 'text/css';
      script.id = 'tteui';
      script.rel = "stylesheet";
      script.href = chrome.extension.getURL('/styles/style-stack-1.css') + "?" + Date.now();
      document.head.appendChild(script);
      break;

    case 2:
      script = document.createElement('link');
      script.type = 'text/css';
      script.id = 'tteui';
      script.rel = "stylesheet";
      script.href = chrome.extension.getURL('/styles/style-stack-2.css') + "?" + Date.now();
      document.head.appendChild(script);
      break;

    default:
      script = document.createElement('link');
      script.type = 'text/css';
      script.id = 'tteui';
      script.rel = "stylesheet";
      script.href = chrome.extension.getURL('/styles/style.css') + "?" + Date.now();
      document.head.appendChild(script);
      break;
  }
}

var script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'tteui';
    script.src = chrome.extension.getURL('/scripts/tte.js') + "?" + Date.now();
    document.head.appendChild(script);

    script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'ttecli';
    script.src = chrome.extension.getURL('/scripts/turntablecli.js') + "?" + Date.now();
    document.head.appendChild(script);
    
    script = document.createElement('link');
    script.type = 'text/css';
    script.id = 'tteui-base';
    script.rel = "stylesheet";
    script.href = chrome.extension.getURL('/styles/base.css') + "?" + Date.now();
    document.head.appendChild(script);
    
    script = document.createElement('link');
    script.type = 'text/css';
    script.id = 'tteui-jq';
    script.rel = "stylesheet";
    script.href = chrome.extension.getURL('/styles/jquery-ui.css') + "?" + Date.now();
    document.head.appendChild(script);
    
window.sendEvent = document.createEvent("Event");
window.sendEvent.initEvent("tteEventExt", true, true);
window.sendData = function(data) {
  $('#tteui-msg').html(JSON.stringify(data))[0].dispatchEvent(window.sendEvent);
}
