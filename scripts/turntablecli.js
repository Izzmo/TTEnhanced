(function() {
  var TurntableCli, TurntableProxy,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  TurntableProxy = (function() {

    function TurntableProxy(turntable) {
      this.turntable = turntable;
      this.updateRoomManager = __bind(this.updateRoomManager, this);

      this.updateRoom = __bind(this.updateRoom, this);

      this.updateRoom();
      this.updateRoomManager();
    }

    TurntableProxy.prototype.isReady = function() {
      return (this.room != null) && (this.roomManager != null);
    };
    
    TurntableProxy.prototype.updateRoom = function() {
      if(typeof tte == 'undefined') return setTimeout(this.updateRoom, 100);
      this.room = tte.ttObj;
      if (this.room == null) {
        return setTimeout(this.updateRoom, 100);
      }
    };

    TurntableProxy.prototype.updateRoomManager = function() {
      if(typeof tte == 'undefined') return setTimeout(this.updateRoom, 100);
      this.roomManager = tte.ttRoomObjs;
      if (!this.roomManager) {
        return setTimeout(this.updateRoomManager, 100);
      }
    };

    TurntableProxy.prototype.getUserIdByName = function(name) {
      var user, userid;
      for (userid in this.room.users) {
        user = this.room.users[userid];
        if (user.name.toLowerCase() === $.trim(name.toLowerCase())) {
          return user.userid;
        }
      }
      return false;
    };

    TurntableProxy.prototype.appendActionMessage = function(text, username) {
      if (username == null) {
        username = "";
      }
      return this.room.appendChatMessage('', username, text, "action");
    };

    TurntableProxy.prototype.toggleMute = function() {
      this.roomManager.set_volume(this.roomManager.volume_bars ? 0 : this.roomManager.last_volume_bars);
      this.roomManager.callback("set_volume", this.roomManager.volume_bars);
      return this.appendActionMessage((this.roomManager.volume_bars ? "Unmuted" : "Muted"), "Sound: ");
    };

    TurntableProxy.prototype.sendSocketMessage = function(data, handler) {
      var deferred, jsonData;
      data.msgid = this.turntable.messageId;
      data.clientId = this.turntable.clientId;
      this.turntable.messageId += 1;
      if (this.turntable.user.id && !data.userid) {
        data.userid = this.turntable.user.id;
        data.userauth = this.turntable.user.auth;
      }
      jsonData = JSON.stringify(data);
      deferred = $.Deferred();
      this.turntable.whenSocketConnected(function() {
        this.turntable.socket.send(jsonData);
        this.turntable.socketKeepAlive(true);
        return this.turntable.pendingCalls.push({
          msgid: data.msgid,
          handler: handler,
          deffered: deferred,
          time: window.util.now()
        });
      });
      return deferred.promise();
    };

    TurntableProxy.prototype.boot = function(userid, reason) {
      var message;
      message = {
        api: "room.boot_user",
        roomid: this.room.roomId,
        target_userid: userid
      };
      if (reason !== "") {
        message.reason = reason;
      }
      this.sendSocketMessage(message);
      return console.log("Booting: " + this.room.users[userid].name + " " + userid + " reason: " + reason);
    };

    TurntableProxy.prototype.removeDj = function(userid) {
      var message;
      message = {
        api: "room.rem_dj",
        roomid: this.room.roomId,
        djid: userid
      };
      if (this.room.isDj(userid)) {
        this.sendSocketMessage(message);
        return console.log("Removing DJ: " + this.room.users[userid].name + " " + userid);
      } else {
        return this.appendActionMessage("" + this.room.users[userid].name + " is not a DJ.", "RemoveDJ: ");
      }
    };

    TurntableProxy.prototype.quitDjing = function() {
      var message;
      message = {
        api: "room.rem_dj",
        roomid: this.room.roomId
      };
      if (this.room.isDj()) {
        this.sendSocketMessage(message);
        return console.log("Removing DJ: You");
      } else {
        return this.appendActionMessage("You are not a DJ.", "QuitDJ: ");
      }
    };

    TurntableProxy.prototype.skipSong = function() {
      var message;
      message = {
        api: "room.stop_song",
        roomid: this.room.roomId
      };
      if (this.room.currentDj === this.room.selfId) {
        return this.sendSocketMessage(message);
      } else {
        return this.appendActionMessage("You are not the current DJ.", "Skip Song: ");
      }
    };

    TurntableProxy.prototype.awesomeSong = function() {
      return this.roomManager.callback("upvote");
    };

    TurntableProxy.prototype.lameSong = function() {
      return this.roomManager.callback("downvote");
    };

    return TurntableProxy;

  })();

  TurntableCli = (function() {
    var commands, currentHistoryIndex, maxHistory, modCommands, suggestedCommand, suggestedCommands, textInput;

    textInput = null;

    maxHistory = 100;

    currentHistoryIndex = 0;

    suggestedCommands = [];

    suggestedCommand = false;

    commands = ["/awesome", "/clear", "/lame", "/mute", "/pm", "/quitdj", "/skip", "/snag"];

    modCommands = ["/boot", "/removedj"];

    function TurntableCli(turntable) {
      this.chooseSuggestedCommand = __bind(this.chooseSuggestedCommand, this);

      this.handleInputKeyUp = __bind(this.handleInputKeyUp, this);

      this.handleInputKeyDown = __bind(this.handleInputKeyDown, this);

      this.handleInputSubmit = __bind(this.handleInputSubmit, this);

      this.init = __bind(this.init, this);
      this.turntableProxy = new TurntableProxy(turntable);
      this.textHistory = [];
      this.init();
    }

    TurntableCli.prototype.init = function() {
      var textForm;
      if (!this.turntableProxy.isReady()) {
        setTimeout(this.init, 200);
        return;
      } else {
        console.log("TurntableCLI Initialized");
      }
      textForm = $(this.turntableProxy.room.nodes.chatForm);
      textInput = $(this.turntableProxy.room.nodes.chatText);
      if (this.turntableProxy.room.isMod()) {
        commands = commands.concat(modCommands);
      }
      textForm.unbind('submit');
      textForm.submit(this.handleInputSubmit);
      textInput.unbind('keydown');
      textInput.keyup(this.handleInputKeyUp);
      textInput.keydown(this.handleInputKeyDown);
      return $(textInput).attr("placeholder", "Enter a message or command");
    };

    TurntableCli.prototype.handleInputSubmit = function(event) {
      var text;
      event.preventDefault();
      text = $.trim(textInput.val());
      if (text === "") {
        return;
      }
      if (!this.parseInputText(text)) {
        this.addTextEntry(text);
        return this.turntableProxy.room.speak(event);
      }
    };

    TurntableCli.prototype.handleInputKeyDown = function(event) {
      var isText, key, next, previous, target;
      target = event.target;
      key = event.charCode || event.keyCode;
      if (suggestedCommand && textInput.val().match(/^\//)) {
        switch (key) {
          case 13:
          case 9:
            this.chooseSuggestedCommand(target, suggestedCommand);
            return false;
          case 38:
            previous = $(".suggestedName.selected").prev();
            if (previous.length) {
              suggestedCommand = $(".suggestedName.selected").removeClass("selected").prev().addClass("selected").text();
            }
            return false;
          case 40:
            next = $(".suggestedName.selected").next();
            if (next.length) {
              suggestedCommand = $(".suggestedName.selected").removeClass("selected").next().addClass("selected").text();
            }
            return false;
          case 27:
          case 39:
            if ((key === 39 && target.selectionEnd === target.value.length) || key === 27) {
              this.turntableProxy.room.cancelTypeahead();
              return false;
            }
        }
      } else if (!suggestedCommand && !this.turntableProxy.room.suggestedName) {
        switch (key) {
          case 38:
            this.textHistoryNext();
            break;
          case 40:
            this.textHistoryPrev();
            break;
          case 27:
            this.clear(false);
            break;
          case 67:
            if (event.ctrlKey) {
              isText = textInput.val() === '' ? false : true;
              this.clear(isText);
            }
        }
      }
      return this.turntableProxy.room.chatKeyDownListener(event);
    };

    TurntableCli.prototype.handleInputKeyUp = function(event) {
      var key, offset, suggest, text,
        _this = this;
      text = $.trim(textInput.val());
      key = event.charCode || event.keyCode;
      if (text === "") {
        currentHistoryIndex = 0;
      }
      if (key === 38 || key === 40 || key === 27 || (key === 39 && event.target.selectionEnd === event.target.value.length)) {
        return;
      }
      suggestedCommand = false;
      if (/^\//.test(text)) {
        $("#nameSuggest").remove();
        suggestedCommands = [];
        $.each(commands, function() {
          if ((this.toLowerCase().slice(0, -1).indexOf(text)) === 0) {
            return suggestedCommands.push(this);
          }
        });
        if (false || suggestedCommands.length) {
          window.util.alphabetize(suggestedCommands);
          
          
          var b = ["div#typeahead", {}];
          for(var e = 0, a = suggestedCommands.length; e < a; e++) {
            var f = (e == 0) ? ".selected" : "";
            b.push(["div.suggestion" + f, {}, suggestedCommands[e]]);
          }
          suggest = window.util.buildTree(b);
          suggestedCommand = suggestedCommands[0];
          $("body").append(suggest);
          offset = textInput.offset();
          $(suggest).css({
            left: "" + (offset.left + 1) + "px",
            top: "" + (offset.top + 1 - $(suggest).outerHeight()) + "px"
          });
          $(".suggestedName").click(function(option) {
            return _this.chooseSuggestedCommand(false, $(option.target).text());
          });
          $(".suggestedName").mouseover(function(option) {
            if (!$(this).hasClass("selected")) {
              suggestedCommand = $(this).text;
              $(".suggestedName.selected").removeClass("selected");
              return $(this).addClass("selected");
            }
          });
        } else {
          return this.turntableProxy.room.chatTextListener(event);
        }
      }
      return true;
    };

    TurntableCli.prototype.chooseSuggestedCommand = function(target, value) {
      if (value == null) {
        return;
      }
      if (target == null) {
        target = textInput;
      }
      $(textInput).val("" + value + " ");
      return this.turntableProxy.room.cancelTypeahead();
    };

    TurntableCli.prototype.addTextEntry = function(entry) {
      var _results;
      this.textHistory.unshift(entry);
      _results = [];
      while (this.textHistory.length > maxHistory) {
        _results.push(this.textHistory.shift());
      }
      return _results;
    };

    TurntableCli.prototype.textHistoryNext = function() {
      if (currentHistoryIndex === 0 && this.textHistory.length <= 0) {
        return $(textInput).val("");
      } else if (currentHistoryIndex >= this.textHistory.length) {
        return $(textInput).val(this.textHistory[this.textHistory.length - 1]);
      } else {
        currentHistoryIndex++;
        return $(textInput).val(this.textHistory[currentHistoryIndex - 1]);
      }
    };

    TurntableCli.prototype.textHistoryPrev = function() {
      if (currentHistoryIndex === 0) {
        return $(textInput).val("");
      } else {
        currentHistoryIndex--;
        return $(textInput).val(this.textHistory[currentHistoryIndex - 1]);
      }
    };

    TurntableCli.prototype.clear = function(inHistory) {
      if (inHistory == null) {
        inHistory = true;
      }
      if (inHistory) {
        this.addTextEntry($.trim($(textInput).val()));
      }
      $(textInput).val('');
      return currentHistoryIndex = 0;
    };

    TurntableCli.prototype.parseInputText = function(text) {
      var arg, args, isPositions, name, names, position, positions, prunedArgs, reason, username, users, _i, _j, _k, _l, _len, _len1, _len2, _len3,
        _this = this;
      if (this.turntableProxy.room.isMod()) {
        switch (true) {
          case /^\/boot[ ]*/i.test(text):
            users = text.split(" /")[0].split(' @');
            users.shift();
            reason = text.split(" /")[1] != null ? text.split(" /")[1] : "";
            if (users.length <= 0) {
              this.turntableProxy.appendActionMessage("No users specified to boot.", "Boot: ");
            } else {
              for (_i = 0, _len = users.length; _i < _len; _i++) {
                username = users[_i];
                if (this.turntableProxy.getUserIdByName($.trim(username))) {
                  this.turntableProxy.boot(this.turntableProxy.getUserIdByName($.trim(username)), reason);
                } else {
                  this.turntableProxy.appendActionMessage("User @" + username + " not found.", "Boot: ");
                }
              }
            }
            this.clear();
            return true;
          case /^\/removedj[ ]*/i.test(text):
            isPositions = false;
            args = text.split(' ');
            args.shift();
            prunedArgs = [];
            for (_j = 0, _len1 = args.length; _j < _len1; _j++) {
              arg = args[_j];
              if (arg !== "") {
                prunedArgs.push($.trim(arg));
              }
            }
            if (prunedArgs.length > 0) {
              isPositions = prunedArgs[0][0] === "@" ? false : true;
              if (isPositions) {
                positions = prunedArgs;
                for (_k = 0, _len2 = positions.length; _k < _len2; _k++) {
                  position = positions[_k];
                  if (isNaN(position) || Number(position) > this.turntableProxy.room.maxDjs || Number(position) < 1) {
                    this.turntableProxy.appendActionMessage("Position " + position + " is invalid.", "RemoveDJ: ");
                    continue;
                  } else {
                    this.turntableProxy.removeDj(this.turntableProxy.room.djIds[position - 1]);
                  }
                }
              } else {
                names = text.split(' @');
                names.shift();
                for (_l = 0, _len3 = names.length; _l < _len3; _l++) {
                  name = names[_l];
                  if (this.turntableProxy.getUserIdByName(name)) {
                    this.turntableProxy.removeDj(this.turntableProxy.getUserIdByName(name));
                  }
                }
              }
            } else {
              this.turntableProxy.appendActionMessage("No DJ's specified to remove.", "RemoveDJ: ");
            }
            this.clear();
            return true;
        }
      }
      switch (true) {
        case /^\/awesome[ ]*$/i.test(text):
          this.turntableProxy.awesomeSong();
          this.clear();
          return true;
        case /^\/clear[ ]*$/i.test(text):
          $(window.turntableCli.turntableProxy.room.nodes.chatLog).find('div.message').remove();
          this.clear();
          return true;
        case /^\/lame[ ]*$/i.test(text):
          this.turntableProxy.lameSong();
          this.clear();
          return true;
        case /^\/mute[ ]*$/i.test(text):
          this.turntableProxy.toggleMute();
          this.clear();
          return true;
        case /^\/pm[ ]*.+/i.test(text):
          name = text.split(" /")[0].split(' @')[1];
          if (this.turntableProxy.getUserIdByName(name)) {
            if ((window.turntable.buddyList.pmWindows[this.turntableProxy.getUserIdByName(name)] != null) && !window.turntable.buddyList.pmWindows[this.turntableProxy.getUserIdByName(name)].isClosed) {
              if (window.turntable.buddyList.pmWindows[this.turntableProxy.getUserIdByName(name)].isMinimized) {
                window.turntable.buddyList.pmWindows[this.turntableProxy.getUserIdByName(name)].open(true);
              }
            } else {
              this.turntableProxy.room.handlePM({
                senderid: this.turntableProxy.getUserIdByName(name)
              });
            }
            setTimeout((function() {
              return window.turntable.buddyList.pmWindows[_this.turntableProxy.getUserIdByName(name)].open(true);
            }), 500);
          } else {
            this.turntableProxy.appendActionMessage("User @" + name + " doesn't appear to be in this room.", "PM: ");
          }
          this.clear();
          return true;
        case /^\/quitdj[ ]*$/i.test(text):
          this.turntableProxy.quitDjing();
          this.clear();
          return true;
        case /^\/skip[ ]*$/i.test(text):
          this.turntableProxy.skipSong();
          this.clear();
          return true;
        case /^\/snag[ ]*$/i.test(text):
          this.turntableProxy.room.addSong("queue");
          this.clear();
          return true;
      }
      return false;
    };

    return TurntableCli;

  })();

  $(document).ready(function() {
    return window.turntableCli = new TurntableCli(window.turntable);
  });

}).call(this);
