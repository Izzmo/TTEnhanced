(function() {
  if(window.izzmo != undefined && window.izzmo.ui != undefined) {
    turntable.removeEventListener("message", window.izzmo.ui.listener);
  }
  
  window.izzmo = {
    ttObj: null,
    attempts: 0,
    timers: [],
    timerHover: null,
    downvoters: [],
    spotSaving: {
      spot_saving: false,
      spot_attempts: [],
      boot_msg: 'Please stop trying to get on deck, the spot is reserved!',
      spot_users: [],
    },
    settings: {
      boot_linkers: true
    },
    isAfk: function(uid) {
      for(var prop in window.izzmo.timers) {
        if(window.izzmo.timers[prop].userid == uid) {
          var afk = (window.izzmo.timers[prop].time <= ((new Date().getTime()) - 600000));
          window.izzmo.timers[prop].time = new Date().getTime();
          return afk;
        }
      }
      // person doesn't exist in array, so add them
      window.izzmo.timers.push({userid: uid, time: new Date().getTime()});
      return false;
    },
    getAfkTime: function(uid) {
      var t = (new Date()).getTime();
      for(var prop in window.izzmo.timers) {
        if(window.izzmo.timers[prop].userid == uid) {
          t = window.izzmo.timers[prop].time;
          break;
        }
      }
      var seconds = ((new Date()).getTime() - t) / 1000,
          minutes = seconds / 60,
          hours = minutes / 60,
          time = "";
      if(hours >= 1) {
        hours = Math.round(hours);
        if(hours < 10)
          time += "0";
        time += hours + ":";
      }
      else
        time += "00:";

      if(minutes >= 1) {
        minutes = parseInt(minutes % 60);
        if(minutes < 10)
          time += "0";
        time += minutes + ":";
      }
      else
        time += "00:";

      if(seconds >= 1) {
        seconds = parseInt(seconds % 60);
        if(seconds < 10)
          time += "0";
        time += seconds;
      }
      else
        time += "00";

      return time;
    },
    sendMsg: function(msg) {
      turntable.socket.send(JSON.stringify({
        api: "room.speak",
        roomid: TURNTABLE_ROOMID,
        text: msg,
        msgid: turntable.messageId++,
        clientid: turntable.clientId,
        userid: turntable.user.id,
        userauth: turntable.user.auth
      }));
    },
    sendPm: function(userid, msg) {
      turntable.socket.send(JSON.stringify({
        api: "pm.send",
        receiverid: userid,
        text: msg,
        msgid: turntable.messageId++,
        clientid: turntable.clientId,
        userid: turntable.user.id,
        userauth: turntable.user.auth
      }));
    },
    eventManager: {
      event: document.createEvent("Event"),
      messages: [],
      queue: function(params, callback) {
        var msgId = window.izzmo.eventManager.messages.push(callback),
            data = $.extend({'msgId': msgId}, params);
        $('#izzui-msg').html(JSON.stringify(data))[0].dispatchEvent(window.izzmo.eventManager.event);
      },
      init: function() {
        // setup event handler
        window.izzmo.eventManager.event.initEvent("izzEventWeb", true, true);
        $('#izzui-msg').bind('izzEventExt', function() {
          var data = JSON.parse($(this).html()),
              func = window.izzmo.eventManager.messages[data.msgId-1];
          console.log('Received from extension: ');
          console.log(data);
          if(func != undefined)
            func(data);
          delete window.izzmo.eventManager.messages[data.msgId-1];
        });
      }
    },
    init: function() {
      window.izzmo.eventManager.init();
      window.izzmo.modcli.init();
    }
  };

  window.izzmo.utils = {
    getNameByUserId: function(userId) {
        return window.izzmo.ttObj.users[userId.toString()].name;
      },

    getUserIdByName: function(name) {
      var users = window.izzmo.ttObj.users;
      for(var i in users) {
        if(users[i].name.toLowerCase() == $.trim(name.toLowerCase())) {
          return users[i].userid;
        }
      }
      return 0;
    },

    isNumeric: function(vTestValue)
    {
      // put the TEST value into a string object variable
      var sField = new String($.trim(vTestValue));
      
      // check for a length of 0 - if so, return false
      if(sField.length==0) { return false; }
      else if(sField.length==1 && (sField.charAt(0) == '.' || sField.charAt(0) == ',' || (sField.charAt(0) == '-'))) { return false; }
      
      // loop through each character of the string
      for(var x=0; x < sField.length; x++) {
        // if the character is < 0 or > 9, return false (not a number)
        if((sField.charAt(x) >= '0' && sField.charAt(x) <= '9') || sField.charAt(x) == '.' || sField.charAt(x) == ',' || (sField.charAt(x) == '-' && x==0)) { /* do nothing */ }
        else { return false; }
      }
      
      // made it through the loop - we have a number
      return true;
    }
  };

  window.izzmo.modcli = {
    parseInput: function(event) {
      event.preventDefault();
        
      var roomId = window.izzmo.ttObj.roomId;
      var text = $.trim(window.izzmo.ttObj.nodes.chatText.value);
      var args = [];

      // Check for possible command and pass to Turntable of not a command
      if(!/^\//.test(text) || !window.izzmo.ttObj.isMod()) {window.izzmo.modcli.pass(event);return}

      // boot
      if(/^\/boot .+/.test(text) || /^\/b .+/.test(text)) {

        // Get args
        args = text.split(" /")[0].split(' @');
        args.shift();
        if(args.length <= 0) {
          console.log("You specified no users to boot");
          window.izzmo.modcli.resetInput();
          return;
        }
        // Get Reason
        var reason = text.split(" /")[1] == undefined ? "" : text.split(" /")[1];

        // Get UserIds
        for(var i = 0; i < args.length; i++) {
          if(window.izzmo.utils.getUserIdByName($.trim(args[i]))) {
            
            // Create API request object
            var bootRequest = {
              api: "room.boot_user",
              roomid: roomId,
              target_userid: window.izzmo.utils.getUserIdByName(args[i])
            };
            if(reason != "") bootRequest.reason = reason;

            // Send Request
            window.izzmo.socket(bootRequest);
            console.log("Booting " + args[i]);
          } else {
            // Couldn't find user
            console.log("No user found by " + args[i]);
          }
        }

        window.izzmo.modcli.resetInput();
        return;
      }

      // Remove DJ by name
      if(/^\/removedj .+/.test(text) || /^\/rmdj .+/.test(text)) {

        // Get args
        args = text.split(' @');
        args.shift();
        if(args.length <= 0) {
          console.log("You specified no djs to remove");
          window.izzmo.modcli.resetInput();
          return;
        }

        // Get DJ Ids
        for(var i = 0; i < args.length; i++) {
          if(args[i] != "" && window.izzmo.utils.getUserIdByName($.trim(args[i])) && window.izzmo.ttObj.isDj(window.izzmo.utils.getUserIdByName($.trim(args[i])))) {

            // Create API request object
            var removeDjRequest = {
              api: "room.rem_dj",
              roomid: roomId,
              djid: window.izzmo.utils.getUserIdByName($.trim(args[i]))
            };
            window.izzmo.socket(removeDjRequest);
            console.log("Removing " + args[i]);
          } else {
            // Couldn't find user
            if(args[i] != "") console.log('No DJ found by ' + args[i])
          }
        }

        window.izzmo.modcli.resetInput();
        return;
      }

      // Remove DJ by number
      if(/^\/removedjnum .+/.test(text) || /^\/rmdjn .+/.test(text)) {

        // Get Numbers
        args = text.split(' ');
        args.shift();

        for(var i = 0; i < args.length; i++) {
          if(window.izzmo.utils.isNumeric(args[i])) {
            if(args[i] > 0 && args[i] < window.izzmo.ttObj.maxDjs) {
              var removeDjByNumberRequest = {
                api: "room.rem_dj",
                roomid: roomId,
                djid: $('.avatar_laptop:eq(' + (args[i] - 1) + ')').attr("data-userid")
              }
              window.izzmo.socket(removeDjRequest);
              console.log("Removing " + window.izzmo.utils.getNameByUserId($('.avatar_laptop:eq(' + (args[i] - 1) + ')').attr("data-userid")));
            } else {
              if(args[i] != "") console.log('No DJ found at position ' + args[i]);
            }
          } else {
            if(args[i] != "") console.log('value is not numeric: ' + args[i]);
          }
        }

        window.izzmo.modcli.resetInput();
        return;
      }

      window.izzmo.modcli.pass(event);
    },

    resetInput: function() {
      window.izzmo.ttObj.nodes.chatText.value = "";
    },

    pass: function(event) {
      window.izzmo.ttObj.speak(event);
    },

    init: function() {
      // Unbind Turntable's handler and bind our handler
      $(window.izzmo.ttObj.nodes.chatForm).unbind('submit');
      $(window.izzmo.ttObj.nodes.chatForm).submit(window.izzmo.modcli.parseInput);
    }
  };

  window.izzmo.ui = {
    settings: {
      animations: true,
      favorites: [],
      notifierKeywords: [],
      displayType: 0
    },
    version: '2.1.6',
    newUpdatesMsg: '<ul>'
                  +'<li>Bug Fix: Updated settings screen so it is easier to see that you need to press enter to enter custom notifications.</li>'
                  +'<li>Bug Fix: When updating from a previous version, the guest list and/or chat would overlay one another.</li>'
                  +'</ul>',

    upvotes: 0,
    downvotes: 0,
    snags: 0,

    listener: function(d) {
      switch(d.command) {
        case 'snagged':
          var val = parseInt(window.izzmo.ui.votes.find('span:last-child').html());
          window.izzmo.ui.votes.find('span:last-child').html(++val);
          window.izzmo.isAfk(d.senderid);

          // Update Snag count
          window.izzmo.ui.snags += 1;
          window.izzmo.ui.updateVoteDisplays(window.izzmo.ui.upvotes,window.izzmo.ui.downvotes,window.izzmo.ui.snags,-1);
          break;
          
        case 'update_votes':
          $(window.izzmo.ui.votes.find('span')[1]).html(d.room.metadata.upvotes);
          $(window.izzmo.ui.votes.find('span')[0]).html(d.room.metadata.downvotes);
          
          // Get upvotes count
          window.izzmo.ui.upvotes = d.room.metadata.upvotes;

          var $user = $('#' + d.room.metadata.votelog[0][0]);
          if(!$user.length)
            $user = guestListAddUser(d.room.metadata.votelog[0][0]);
          if(d.room.metadata.votelog[0][1] == "up") {
            $user.addClass('voteup').removeClass('votedown');
            var pos = $.inArray(d.room.metadata.votelog[0][0], window.izzmo.downvoters)
            if(pos >= 0)
              delete window.izzmo.downvoters[pos];

            // Reconcile downvotes
            window.izzmo.ui.downvotes = d.room.metadata.downvotes;
          }
          else {
            $user.addClass('votedown').removeClass('voteup');
            if($.inArray(d.room.metadata.votelog[0][0], window.izzmo.downvoters) == -1)
              window.izzmo.downvoters.push(d.room.metadata.votelog[0][0]);

            // Update downvote tally
            window.izzmo.ui.downvotes += 1;
          }
          window.izzmo.isAfk(d.room.metadata.votelog[0][0]);
          break;
          
        case 'newsong':
          $(window.izzmo.ui.votes.find('span')[0]).html(0);
          $(window.izzmo.ui.votes.find('span')[1]).html(0);
          window.izzmo.ui.votes.find('span:last-child').html(0);
          window.izzmo.downvoters = [];
          window.izzmo.ui.guestList();
          window.izzmo.ui.updateSongCount();

          // Reset Vote Counts
          window.izzmo.ui.upvotes = 0;
          window.izzmo.ui.downvotes = 0;
          window.izzmo.ui.snags = 0;

          break;
          
        case 'registered':
          window.izzmo.ui.guestListAddUser(d.user[0]);
          $("span#totalUsers").text(window.izzmo.ui.numUsers());
          window.izzmo.timers.push({userid: d.user[0].userid, time: new Date().getTime()});
          break;
          
        case 'deregistered':
          window.izzmo.ui.guestListRemoveUser(d.user[0].userid);
          $("span#totalUsers").text(window.izzmo.ui.numUsers());
          for(var prop in window.izzmo.timers) {
            if(window.izzmo.timers[prop].userid == d.user[0].userid) {
              delete window.izzmo.timers[prop];
              break;
            }
          }
          break;
          
        case 'pmmed':
          window.izzmo.ui.sendNotification('PM Notification', turntable.buddyList.pmWindows[d.senderid].otherUserName + ': ' + d.text);
          window.izzmo.isAfk(d.senderid);
          break;
          
        case 'speak':
          var list = izzmo.ttObj.users[izzmo.ttObj.selfId].name;
          $.each(window.izzmo.ui.settings.notifierKeywords, function(i, v) {
            if(v != undefined && v.length > 0)
              list += '|' + v;
          });
          if(d.text.search(new RegExp(list, 'i')) >= 0) {
            window.izzmo.ui.sendNotification('Chat Notification', d.name + ': ' + d.text);
          }
          if(window.izzmo.settings.boot_linkers && d.text.search(/https?:\/\/(www.)?(((tt|turntable)\.fm)|(plug\.dj))(\/[a-zA-Z0-9\-\_]*)*\/?/ig) >= 0 && window.izzmo.ttObj.isMod() && !window.izzmo.ttObj.isMod(d.userid)) {
            window.izzmo.socket({
              api: 'room.boot_user',
              roomid: TURNTABLE_ROOMID,
              target_userid: d.userid,
              reason: 'Please do not link to other turntable rooms.'
            });
          }
          window.izzmo.isAfk(d.userid);
          break;
          
        case 'rem_dj':
          window.izzmo.ui.guestListAddUser(d.user[0]);
          break;
          
        case 'add_dj':
          window.izzmo.ui.guestListAddUser(d.user[0]);
          if(window.izzmo.ttObj.isMod() && window.izzmo.spotSaving.spot_saving) {
            var allOnDeck = 0;
            var total = window.izzmo.spotSaving.spot_users.length;
            $.each(window.izzmo.spotSaving.spot_users, function(i, v) {
              var uid = '';
              $.each(window.izzmo.ttObj.users, function(i2, v2) {
                if(v2.name.toLowerCase() == v)
                  uid = v2.userid;
              });

              if(uid == '')
                total--; //person not in the room, so don't take him into account'
              else {
                if($.inArray(uid, window.izzmo.ttObj.djIds) >= 0) {
                  allOnDeck++;
                };
              }
            });
            if(allOnDeck == total)
              window.izzmo.spotSaving.spot_saving = false;
            else {
              if($.inArray(d.user[0].name.toLowerCase(), window.izzmo.spotSaving.spot_users) < 0) {
                if(!window.izzmo.ttObj.isMod(d.user[0].userid) && allOnDeck != total) {
                  window.izzmo.spotSaving.spot_attempts.push(d.user[0].userid);
                  var count = 0;
                  $.each(window.izzmo.spotSaving.spot_attempts, function(i, v) {
                    if(v == d.user[0].userid) count++;
                  });
                  if(count > 2) { 
                    window.izzmo.socket({
                      api: 'room.boot_user',
                      roomid: TURNTABLE_ROOMID,
                      target_userid: d.user[0].userid,
                      reason: window.izzmo.spotSaving.boot_msg
                    });
                  }
                  else {
                    window.izzmo.callback('remove_dj', d.user[0].userid);
                    window.izzmo.sendMsg(':exclamation:Sorry ' + d.user[0].name + ', that spot is reserved!');
                  }
                }
                else {
                  window.izzmo.spotSaving.spot_attempts = [];
                  window.izzmo.spotSaving.spot_saving = false;
                }
              }
            }
          }
          break;
      }
    },

    override_set_dj_points: function(points) {
      setTimeout(function(){window.izzmo.ui.updateVoteDisplays(window.izzmo.ui.upvotes,window.izzmo.ui.downvotes,window.izzmo.ui.snags,points);},250);
    },

    updateVoteDisplays: function(upvotes,downvotes,snags,points) {
      if(points < 0) {points = Number(window.izzmo.ttRoomObjs.current_dj[3].html().split(" ")[0].replace(',',''));}
      var suffix = " points";
      suffix += "<br/>+" + upvotes.toString();
      suffix += " / -" + downvotes.toString();
      suffix += " / &#9829;" + snags.toString();

      // Dj Display
      if(window.izzmo.ttRoomObjs.current_dj)
      {
        window.izzmo.ttRoomObjs.current_dj[3].show();
        window.izzmo.ttRoomObjs.current_dj[3].html(window.izzmo.ttRoomObjs.commafy(points) + suffix);
        window.izzmo.ttRoomObjs.current_dj[4].points = points;
      }

      // Song List Display
      if($('div.songlog:first div.song:first div.tteTrackHistoryVotes:first').length <= 0)
      {
        var content = $('<div class="tteTrackHistoryVotes"> </div>');
        content.css({
          fontSize:"10px",
          textAlign:"center"
        });
        $('div.songlog:first div.song:first div.songinfo:first').append(content);
      }
      $('div.songlog:first div.song:first div.tteTrackHistoryVotes:first').html('+' + upvotes + '/-' + downvotes + '<br/>&#9829; ' + snags);
    },

    numUsers: function() {
      var count = 0;
      for(var prop in window.izzmo.ttObj.users)
        count++;
      return count;
    },
    userSort: function (j, i) {
      var h = j.name.toLowerCase(),
          k = i.name.toLowerCase();
      return (k > h) ? -1 : (k < h) ? 1 : 0;
    },
    guestList: function () {
      var supers = [],
          mods = [],
          djs = [],
          fans = [],
          users = [],
          g = $(".guest-list-container .guests");
      
      // get each type
      for (var f in window.izzmo.ttObj.users) {
        if(window.izzmo.ttObj.isDj(f))
          djs.push(window.izzmo.ttObj.users[f]);
        else if(window.izzmo.ttObj.isSuperuser(f))
          supers.push(window.izzmo.ttObj.users[f]);
        else if(window.izzmo.ttObj.isMod(f))
          mods.push(window.izzmo.ttObj.users[f]);
        else if(window.izzmo.ttObj.users[f].fanof)
          fans.push(window.izzmo.ttObj.users[f]);
        else
          users.push(window.izzmo.ttObj.users[f]);
      }

      var c = g.find(".guest.selected").data("id");
      g.find("div").remove();

      // sort
      window.izzmo.ui.guestListAddUsers(g, 'super', supers.sort(window.izzmo.ui.userSort));;
      window.izzmo.ui.guestListAddUsers(g, 'mod', mods.sort(window.izzmo.ui.userSort));
      window.izzmo.ui.guestListAddUsers(g, 'dj', djs.sort(window.izzmo.ui.userSort));
      window.izzmo.ui.guestListAddUsers(g, 'fan', fans.sort(window.izzmo.ui.userSort));
      window.izzmo.ui.guestListAddUsers(g, 'user', users.sort(window.izzmo.ui.userSort));
      //window.izzmo.ui.guestListAddUsers(g, 'user', $.merge(fans.sort(window.izzmo.ui.userSort), users.sort(window.izzmo.ui.userSort)));
      
      if(fans.length > 0)
        $('#desc-user > div.desc').hide();
      
      $.each(window.izzmo.ttObj.upvoters, function(i, v) {
        g.find('#' + v).addClass('voteup');
      });
      
      $("span#totalUsers").text(window.izzmo.ui.numUsers());
    },
    guestListAddUsers: function(obj, type, userList) {
      var title = '',
          html = '';
          
      switch(type) {
        case 'super':
          title = 'Super Users';
          break;
        
        case 'mod':
          title = 'Moderators';
          break;
          
        case 'dj':
          title = 'DJs';
          break;
          
        case 'fan':
          title = 'Users';
          break;
          
        default:
          title = 'Users';
          break;
      }
      
      groupContainer = $('<div id="desc-' + type + '" ' + ((!userList.length) ? 'style="display:none;"' : '') + '></div>');
      groupHeader = $('<div class="desc black-right-header"' + ((type == 'super') ? ' style="display: none;"' : '') + '><div class="desc-inner header-text">' + title + '</div></div>');
      groupContainer.append(groupHeader);
      $.each(userList, function(i, v) {
        groupContainer.append(window.izzmo.ui.guestListGetUserHtml(type, v));
      });
      obj.append(groupContainer);
    },
    guestListAddUser: function(user) {
      var type, $s;
      if(window.izzmo.ttObj.isDj(user.userid))
        type = 'dj';
      else if(window.izzmo.ttObj.isSuperuser(user.userid))
        type = 'super';
      else if(window.izzmo.ttObj.isMod(user.userid))
        type = 'mod';
      else if(user.fanof) {
        type = 'fan';
        $('#desc-user > div.desc').hide();
      }
      else
        type = 'user';
      $('#' + user.userid).remove();
      
      $s = $('#desc-' + type);
      var text = window.izzmo.ui.guestListGetUserHtml(type, user),
          found = undefined;
      $s.find('div.guest').each(function() {
        var $this = $(this);
        if(window.izzmo.ui.userSort(user, {name: $this.find('div.guestName').html()}) <= 0) {
          found = $this;
          return false;
        }
      });
      if(found == undefined)
        $s.append(text);
      else
        found.before(text);
      $s.show();
      return text;
    },
    guestListRemoveUser: function(uid) {
      var $e = $('#' + uid);
      if($e.parent().find('div.guest').length == 1)
        $e.parent().hide();
      $e.remove();
    },
    guestListGetUserHtml: function(type, user) {
      var icons = '';
      if(window.izzmo.ttObj.isSuperuser(user.userid))
        icons += '<img src="http://static.turntable.fm.s3.amazonaws.com/images/room/superuser_icon.png" alt="Super User" />';
      else if(window.izzmo.ttObj.isMod(user.userid))
        icons += '<img src="http://static.turntable.fm.s3.amazonaws.com/images/room/mod_icon.png" alt="Moderator" />';
      
      var vote = '';
      if($.inArray(user.userid, window.izzmo.downvoters) >= 0)
        vote = 'votedown';
      else if($.inArray(user.userid, window.izzmo.ttObj.upvoters) >= 0)
        vote = 'voteup';
      
      return  $('<div class="guest ' + type + ' ' + vote + ' ' + ((user.fanof && type == user) ? 'fan' : '') + '" id="' + user.userid + '">'
            + '<div class="guestAvatar"><img src="https://s3.amazonaws.com/static.turntable.fm/roommanager_assets/avatars/' + user.avatarid + '/scaled/55/headfront.png" height="20" alt="" /></div>'
            + '<div class="icons">' + icons + ((user.fanof) ? '<img src="http://www.pinnacleofdestruction.net/tt/images/heart_small.png" alt="Fan" />' : '') + '</div>'
            + '<div class="idletime"></div>'
            + '<div class="guestName">' + user.name + '</div>'
            + '</div>')
            .bind('click', function() {
              var $this = $(this),
                  l = Room.layouts.guestOptions(window.izzmo.ttObj.users[$this.attr('id')], window.izzmo.ttObj);
              delete l[3];
              l[2].push([
                'a.guestOption',
                {
                  event: { click: function() {
                    window.izzmo.eventManager.queue({ api: 'getNote', userid: $this.attr('id') }, function(response) {
                      var $html = $(util.buildTree(
                        ["div.modal", {},
                          ["div.close-x", {event: { click: util.hideOverlay } }],
                          ["h1", "Set User Note"],
                          ["br"],
                          ["div", {}, "Enter any information you would like about this user below."],
                          ["br"],
                          ["textarea#userNoteField.textarea", { maxlength: 400 } ],
                          ["br"], ["br"],
                          ["div.ok-button.centered-button", { event: { click: function() {
                                  var val = $('#userNoteField').val(), uid = $this.attr('id');
                                  window.izzmo.eventManager.queue({ api: 'setNote', userid: uid, note: val });
                                  util.hideOverlay();
                                }
                              }
                            }
                          ]
                        ]
                      ));
                      $html.find('#userNoteField').val(response.note);
                      util.showOverlay($html);
                    });
                    $(this).parent().remove();
                  }},
                  href: '#'
                },
                'Set Note'
              ]);
              var c = $(util.buildTree(l)).css({
                top: $this.offset().top + 'px',
                left: $this.offset().left + 'px',
                right: 'auto'
              });
              $('body').append(c);
            })
            .bind('mouseenter', function() {
              $this = $(this);
              $this.find('div.idletime').html(window.izzmo.getAfkTime($this.attr('id'))).show();
              $this.find('div.icons').hide();
              clearInterval(window.izzmo.timerHover);
              window.izzmo.timerHover = setInterval(function() {
                $this.find('div.idletime').html(window.izzmo.getAfkTime($this.attr('id')));
              }, 1000);
            })
            .bind('mouseleave', function() {
              $(this).find('div.idletime').hide();
              $(this).find('div.icons').show();
              clearInterval(window.izzmo.timerHover);
            });
    },
    appendChatMessage: function (f, a, h, j) {
      var e = this.nodes.chatLog;
      var g = (e.scrollTop + $(e).height() + 20 >= e.scrollHeight);
      var b = util.buildTree(Room.layouts.chatMessage);
      var i = this;
      $(b).find(".speaker").text(a).click(function (e) {
        if(window.izzmo.ui.settings.showChatAvatarTooltip)
          window.izzmo.ttRoomObjs.toggle_listener(f);
        var l = Room.layouts.guestOptions(window.izzmo.ttObj.users[f], window.izzmo.ttObj);
        delete l[3];
        l[2].splice(4, 0, [
          'a.guestOption',
          {
            event: { click: function() {
              window.izzmo.eventManager.queue({ api: 'getNote', userid: f }, function(response) {
                var $html = $(util.buildTree(
                  ["div.modal", {},
                    ["div.close-x", {event: { click: util.hideOverlay } }],
                    ["h1", "Set User Note"],
                    ["br"],
                    ["div", {}, "Enter any information you would like about this user below."],
                    ["br"],
                    ["textarea#userNoteField.textarea", { maxlength: 400 } ],
                    ["br"], ["br"],
                    ["div.ok-button.centered-button", { event: { click: function() {
                            var val = $('#userNoteField').val();
                            window.izzmo.eventManager.queue({ api: 'setNote', userid: f, note: val });
                            util.hideOverlay();
                          }
                        }
                      }
                    ]
                  ]
                ));
                $html.find('#userNoteField').val(response.note);
                util.showOverlay($html);
              });
              $('div.guestOptionsContainer').remove();
            }},
            href: '#'
          },
          'Set Note'
        ]);
        var c = $(util.buildTree(l)).css({
          top: $(this).offset().top + 'px',
          left: $(this).offset().left + 'px',
          right: 'auto'
        });
        $('body').append(c);
      });
      
      var list = window.izzmo.ttObj.users[window.izzmo.ttObj.selfId].name,
          c = $(b).find(".text");
      $.each(window.izzmo.ui.settings.notifierKeywords, function(i, v) {
        if(v != undefined && v.length > 0)
          list += '|' + v;
      });
      if(h.search(new RegExp(list, 'i')) >= 0)
        $(b).addClass('mention');
      
      h = util.stripComboDiacritics(h);
      if (h.length > 446) {
          c.attr("title", h.substr(0, 2) == ": " ? h.substr(2) : h);
          h = h.substr(0, 440) + "...";
      }
      c.html(util.messageFilter(h));
      if (j) {
          $(b).addClass(j);
      }
      $(e).append(b);
      if (g) {
          e.scrollTop += 9001;
      }
      var d = $(e).find(".message");
      if (d.length > 500) {
          d.slice(0, 2).remove();
      }
    },
    updateSongCount: function() {
      var count = 0;
      for(fid in turntable.playlist.songsByFid)
        count++;
      $('#totalSongs').html(count);
      return count;
    },
    sendNotification: function(title, text) {
      if(window.izzmo.ui.settings.notifications != 0 && $('html').hasClass('blur') && window.webkitNotifications.checkPermission() == 0) {
        var n = window.webkitNotifications.createNotification('', title, text);
        n.ondisplay = function() { setTimeout(function() {n.cancel()}, 10000); };
        //n.onclose = function() {  };
        n.show();
      }
    },
    toggleAnimations: function() {
      if(window.izzmo.ui.settings.animations) {
        window.izzmo.ui.settings.animations = false;
        window.izzmo.eventManager.queue({api: 'settings', code: 'set', settings: {animations: false}});
        window.izzmo.ui.setAnimations(false);
      }
      else {
        window.izzmo.ui.settings.animations = true;
        window.izzmo.eventManager.queue({api: 'settings', code: 'set', settings: {animations: true}});
        window.izzmo.ui.setAnimations(true);
      }
    },
    setAnimations: function(on) {
      if(on) {
        $('#izzmo-settings-menu-animations-icon').parent().find('div').first().css({backgroundImage: 'url(http://www.pinnacleofdestruction.net/tt/images/check.png)'});
        window.izzmo.ttRoomObjs.add_listener = window.izzmo.ttRoomObjs.__add_listener;
        delete window.izzmo.ttRoomObjs.__add_listener;
        for(var user in window.izzmo.ttObj.users)
          window.izzmo.ttObj.refreshRoomUser(window.izzmo.ttObj.users[user]);
      }
      else {
        $('#izzmo-settings-menu-animations-icon').parent().find('div').first().css({backgroundImage: 'url(http://www.pinnacleofdestruction.net/tt/images/cross.png)'});
        for(var listener in window.izzmo.ttRoomObjs.listeners)
          window.izzmo.ttRoomObjs.rem_listener({userid: listener});
        window.izzmo.ttRoomObjs.__add_listener = window.izzmo.ttRoomObjs.add_listener;
        window.izzmo.ttRoomObjs.add_listener = function() {return;}
      }
    },
    buddyListBuddy: function(d, g, f) {
      var b = ("roomName" in d && !f) ? ["div.room", { }, d.roomName] : "";
      var a = function() {
        d.fanof = true;
        var l = Room.layouts.guestOptions(d, window.izzmo.ttObj);
        delete l[3]; // delete arrow
        l[2].splice(2, 0, l[2].pop());
        var callback = l[2][2][1].event.click.prototype.constructor;
        l[2][2][1].event.click = function() {
          turntable.buddyList.toggle();
          var fcn = eval(callback);
          fcn();
        }
        // now remove unwanted options
        $.each(l[2], function(i, v) {
          if(i < 2) return;
          if(v[2] == "Make a Moderator" || v[2] == "Remove Moderator" || v[2] == "Boot User")
            delete l[2][i];
        });
        // add Go To Room item
        l[2].splice(4, 0, ["a#" + d.userid + ".guestOption", {event: {'click': function() {
          turntable.setPage(d.roomShortcut, d.roomId);
          $('div.guestOptionsContainer').remove();
          turntable.buddyList.toggle();
        }}, href: '#'}, "Go To Room"]);
        l[2].splice(4, 0, [
          'a.guestOption',
          {
            event: { click: function() {
              window.izzmo.eventManager.queue({ api: 'getNote', userid: d.userid }, function(response) {
                var $html = $(util.buildTree(
                  ["div.modal", {},
                    ["div.close-x", {event: { click: util.hideOverlay } }],
                    ["h1", "Set User Note"],
                    ["br"],
                    ["div", {}, "Enter any information you would like about this user below."],
                    ["br"],
                    ["textarea#userNoteField.textarea", { maxlength: 400 } ],
                    ["br"], ["br"],
                    ["div.ok-button.centered-button", { event: { click: function() {
                            var val = $('#userNoteField').val();
                            window.izzmo.eventManager.queue({ api: 'setNote', userid: d.userid, note: val });
                            util.hideOverlay();
                          }
                        }
                      }
                    ]
                  ]
                ));
                $html.find('#userNoteField').val(response.note);
                util.showOverlay($html);
              });
              $('div.guestOptionsContainer').remove();
            }},
            href: '#'
          },
          'Set Note'
        ]);
        
        // add favorite item
        if($.inArray(d.userid, window.izzmo.ui.settings.favorites) >= 0) {
          l[2].splice(4, 0, ["a#" + d.userid + ".guestOption", {event: {'click': function() {
            var userid = $(this).attr('id');
            window.izzmo.eventManager.queue({api: 'favorite.remove', 'userid': userid});
            window.izzmo.ui.settings.favorites.splice($.inArray(userid, window.izzmo.ui.settings.favorites), 1);
            $('div.guestOptionsContainer').remove();
            $('#buddyList #bl' + $(this).attr('id')).removeClass('favorite');
            window.turntable.fetchBuddyPresence();
          }}, href: '#'}, "Un-Favorite User"]);
        }
        else {
          l[2].splice(4, 0, ["a#" + d.userid + ".guestOption", {event: {'click': function() {
            var userid = $(this).attr('id');
            window.izzmo.eventManager.queue({api: 'favorite.add', 'userid': userid});
            window.izzmo.ui.settings.favorites.push(userid);
            $('div.guestOptionsContainer').remove();
            $('#buddyList #bl' + $(this).attr('id')).addClass('favorite').find('div.name').append(' \u2605').end().prependTo($('#buddyList'));
          }}, href: '#'}, "Favorite User"]);          
        }
  
        var c = $(util.buildTree(l)).css({
          top: $(this).offset().top + 'px',
          left: $(this).offset().left + 'px',
          right: 'auto'
        });
        $('body').append(c);
      };
      
      var e = (f) ? "overflowListItem" : "buddy" + d.userid;
      var c;
      if("fbid" in d) {
        c = "https://graph.facebook.com/" + d.fbid + "/picture";
      }
      else {
        if("twitterid_lower" in d) {
          c = "https://api.twitter.com/1/users/profile_image?screen_name=" + d.twitterid_lower + "&size=normal";
        }
        else {
          c = "https://s3.amazonaws.com/static.turntable.fm/roommanager_assets/avatars/" + d.avatarid + "/scaled/55/headfront.png";
        }
      }
      return ["li#bl" + d.userid + "#" + e + ".buddy", {
          event: {
            click: a,
            mouseover: function() {
              $(this).addClass("hover");
            },
            mouseout: function() {
              $(this).removeClass("hover");
            }
          }
        },
        ["div.avatar", { }, ["img", {
          src: c,
          height: "20"
        }]],
        ["div.user", { }, ["div.name", { }, (($.inArray(d.userid, window.izzmo.ui.settings.favorites) >= 0) ? (d.name + ' \u2605') : d.name)],b],
        ["div##status" + d.userid + ".status." + d.status]
      ];
    },
    setDisplay: function(type, change) {
      var $outer = $('#outer'),
          $turntable = $('#turntable'),
          $roomView = $turntable.find('div.roomView'),
          $room = $($turntable.find('div.roomView > div')[1]),
          $topPanel = $('#top-panel'),
          $right = $('#right-panel'),
          height = $room.height(),
          width = $room.width();

      switch(type) {
        case -1:
          // remove share buttons only if in this view
          $topPanel.find('div.share-on').hide();
          if(change) {
            // rebind scroll events
            $(".chatHeader").mousedown(window.izzmo.ttObj.chatResizeStart);
            
            // move chat window back inside right-panel container
            var $chatContainer = $roomView.find('div.chat-container').css({top: '258px', left: '', 'height': '345px'});
            $chatContainer.find('div.messages').css({'height': '283px'});
            $chatContainer.appendTo($right);
            
            // update user list
            var $userContainer = $roomView.find('div.guest-list-container').css({top: '258px', left: '', 'height': '345px'});
            $userContainer.find('div.guests').css({'height': '283px'});
            $userContainer.appendTo($right);
            
            // update sizes on DJ Queue window
            var $playlist = $('#playlist');
            var $view = $playlist.find('div.mainPane');
            $playlist.height(259);
            $view.height(259);
            $view.find('div.songlist').height(166);
            $playlist.find('div.chatBar').remove();
          }
          break;
          
        case 0:
          // 3 Column
          if(change)
            window.izzmo.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          var $chatContainer = $right.find('div.chat-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $chatContainer.find('div.messages').css({'height': (height-62)+'px'});
          $chatContainer.appendTo($roomView);

          // update sizes on DJ Queue window
          var $playlist = $('#playlist');
          var $view = $playlist.find('div.mainPane');
          $playlist.height(height).parent().parent().height(height);
          $view.height(height-25-36);
          $view.find('div.songlist').height(height-25-68-36);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(window.izzmo.ui.updateSongCount() == 0)
              setTimeout(function() { window.izzmo.ui.updateSongCount(); }, 10000);
          }

          // update user list
          var $userContainer = $right.find('div.guest-list-container').css({top: '99px', left: (width+307)+'px', 'height': height+'px'});
          $userContainer.find('div.guests').css({'height': (height-62)+'px'});
          $userContainer.appendTo($roomView);
          break;
          
        case 1:
          // Queue & Guest list stacked
          
          if(change)
            window.izzmo.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          var $chatContainer = $right.find('div.chat-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $chatContainer.find('div.messages').css({'height': (height-62)+'px'});
          $chatContainer.appendTo($roomView);

          // update sizes on DJ Queue window
          var $playlist = $('#playlist');
          var $view = $playlist.find('div.mainPane');
          $playlist.height(301).parent().parent().height(height);
          $view.height(301-25-36);
          $view.find('div.songlist').height(301-25-68-36);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(window.izzmo.ui.updateSongCount() == 0)
              setTimeout(function() { window.izzmo.ui.updateSongCount(); }, 10000);
          }

          // update user list
          var $userContainer = $right.find('div.guest-list-container').css({top: '300px', 'height': '302px'});
          $userContainer.find('div.guests').css({'height': (height-301-62)+'px'});
          break;
          
        case 2:
          // Queue & Chat Stacked
          
          if(change)
            window.izzmo.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          var $chatContainer = $right.find('div.chat-container').css({top: '300px', 'height': '302px'});
          $chatContainer.find('div.messages').css({'height': (height-301-62)+'px'});

          // update sizes on DJ Queue window
          var $playlist = $('#playlist');
          var $view = $playlist.find('div.mainPane');
          $playlist.height(301).parent().parent().height(height);
          $view.height(301-25-36);
          $view.find('div.songlist').height(301-25-68-36);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(window.izzmo.ui.updateSongCount() == 0)
              setTimeout(function() { window.izzmo.ui.updateSongCount(); }, 10000);
          }

          // update user list
          var $userContainer = $right.find('div.guest-list-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $userContainer.find('div.guests').css({'height': (height-62)+'px'});
          $userContainer.appendTo($roomView);
          break;
      }
      if(type >= 0)
        $topPanel.find('div.share-on').show();
    }
  };
  
  izzmo.ui.init = function() {
    for(var prop in window.turntable) {
      if(window.turntable[prop] != undefined && window.turntable[prop].hasOwnProperty('currentDj'))
        window.izzmo.ttObj = window.turntable[prop];
    }
    for(var prop in window.izzmo.ttObj) {
      if(prop.indexOf('Callback') >= 0 && prop != 'sampleCallback') {
        window.izzmo.callback = window.izzmo.ttObj[prop];
        break;
      }
    }
    for(var prop in window.izzmo.ttObj) {
      if(window.izzmo.ttObj[prop] != undefined && window.izzmo.ttObj[prop].hasOwnProperty('div'))
        window.izzmo.ttRoomObjs = window.izzmo.ttObj[prop];
    }
    
    if(window.izzmo.ttObj === null) {
      if(window.izzmo.attempts < 20) {
        window.izzmo.attempts++;
        return setTimeout(function() { window.izzmo.ui.init() }, 1000);
      }
      else
        return alert('Could not find turntable.fm objects. You should refresh your page and try again.');
    }
    window.izzmo.attempts = 0;
    window.izzmo.init();

    window.izzmo.socket = function (c, a) {
        if (c.api == "room.now") {
            return;
        }
        c.msgid = turntable.messageId;
        turntable.messageId += 1;
        c.clientid = turntable.clientId;
        if (turntable.user.id && !c.userid) {
            c.userid = turntable.user.id;
            c.userauth = turntable.user.auth;
        }
        var d = JSON.stringify(c);
        if (turntable.socketVerbose) {
            LOG(util.nowStr() + " Preparing message " + d);
        }
        var b = $.Deferred();
        turntable.whenSocketConnected(function () {
            if (turntable.socketVerbose) {
                LOG(util.nowStr() + " Sending message " + c.msgid + " to " + turntable.socket.host);
            }
            if (turntable.socket.transport.type == "websocket") {
                turntable.socketLog(turntable.socket.transport.sockets[0].id + ":<" + c.msgid);
            }
            turntable.socket.send(d);
            turntable.socketKeepAlive(true);
            turntable.pendingCalls.push({
                msgid: c.msgid,
                handler: a,
                deferred: b,
                time: util.now()
            });
        });
        return b.promise();
    }
    
    var $outer = $('#outer'),
        $turntable = $('#turntable'),
        $roomView = $turntable.find('div.roomView'),
        $room = $($turntable.find('div.roomView > div')[1]),
        $topPanel = $('#top-panel'),
        $right = $('#right-panel'),
        height = $room.height(),
        width = $room.width();

    // Set UI Title
    $('.playlist-container:first div.header-text:first').html('Turntable Enhanced');
    
    // rewrite guest list update function
    window.izzmo.ttObj.__updateGuestList = window.izzmo.ttObj.updateGuestList;
    window.izzmo.ttObj.updateGuestList = function() {return;};
    window.izzmo.ui.guestList();
    
    // add votes to top bar
    $('#top-panel div.votes').first().remove();
    window.izzmo.ui.votes = $('<div class="votes"><img src="http://www.pinnacleofdestruction.net/tt/images/arrow_down_red.png" alt="Lames" /> <span>0</span> <img src="http://www.pinnacleofdestruction.net/tt/images/arrow_up_green.png" alt="Awesomes" /> <span>' + window.izzmo.ttObj.upvoters.length + '</span> <img src="http://www.pinnacleofdestruction.net/tt/images/heart_votes.png" alt="Song Snags" /> <span>0</span></div>');
    $topPanel.find('div.info').append(window.izzmo.ui.votes);
    if(window.izzmo.ttObj.upvoters.length == 0) {
      setTimeout(function() {
        $(window.izzmo.ui.votes.find('span')[1]).html(window.izzmo.ttObj.upvoters.length);
        window.izzmo.ui.guestList();
      }, 2000);
    }

    // override set_dj_points
    window.izzmo.ttRoomObjs.set_dj_points = window.izzmo.ui.override_set_dj_points;
    
    turntable.addEventListener("message", window.izzmo.ui.listener);
    
    // setup AFK Timers
    for(var prop in window.izzmo.ttObj.users) {
      window.izzmo.isAfk(prop);
    }
    
    // update append Chat message function
    window.izzmo.ttObj.appendChatMessage = window.izzmo.ui.appendChatMessage;
    
    // add animations button to menu
    $('#izzmo-settings-menu-animations-icon').parent().remove();
    $('#menuh').find('div.menuItem').last().before('<div class="menuItem"><div class="settingsHead" id="izzmo-settings-menu-animations-icon" /><div class="text">Animations</div></div>');
    $('#izzmo-settings-menu-animations-icon')
    .parent()
    .bind('click', function() {
      window.izzmo.ui.toggleAnimations(this);
    });
    
    // add moderation button to menu
    $('#izzmo-settings-menu-moderation').remove();
    if(window.izzmo.ttObj.isMod()) {
      $('#menuh').find('div.menuItem').last().before('<div id="izzmo-settings-menu-moderation" class="menuItem">Room Moderation</div>');
      $('#izzmo-settings-menu-moderation').bind('click', function() {
        var settings = $(util.buildTree(
        ["div#izzui-settings.settingsOverlay.modal", {},
          ["div.close-x", { event: { click: util.hideOverlay } }],
          ["h1", "Room Moderation"],
          ["br"],
          ["div.spots", {} ],
          ["div.save-changes.centered-button", { event: {
            click: function() {
              window.izzmo.spotSaving.spot_saving = ($('#izzui-settings input.spot_saving')[0].checked);
              window.izzmo.spotSaving.boot_msg = $('#izzui-settings #boot_msg').val();
              window.izzmo.settings.boot_linkers = ($('#izzui-settings input.links_enabled')[0].checked);
              util.hideOverlay();
            }
          } }],
          ["br"]
        ]
      ));

      settings.find('div.spots').first().append('<div><span>Boot Room Linkers?</span><div style="text-align: right; padding-right: 100px;"><input type="checkbox" class="links_enabled" value="1"' + ((window.izzmo.settings.boot_linkers) ? 'checked' : '') + '></div></div>');
      settings.find('div.spots').first().append('<p>If enabled, will automatically boot non-mods from the room for linking to other Turntable.fm rooms.</p>');
      settings.find('div.spots').first().append('<div><span>Save Spots?</span><div style="text-align: right; padding-right: 100px;"><input type="checkbox" class="spot_saving" value="1"' + ((window.izzmo.spotSaving.spot_saving) ? 'checked' : '') + '></div></div>');
      settings.find('div.spots').first().append('<p>Spot saving allows you to moderate who gets up on stage. If enabled, any of the usernames you list below will be allowed on deck, and anyone else who tries to get up will be automatically booted off stage.</p><p>If spot saving and AutoDJ are on, you will not get up on deck unless you add yourself to the list.</p>');
      settings.find('div.spots').first().append('<div><span>Username:</span><input type="text" id="user" size="26" style="font-size: 18px;" /><br /><p>Press the \'enter\' key after you have entered the person\'s name to add them to the list.</p></div>');
      settings.find('div.spots').first().append('<div style="padding: 5px; font-size: 15px; text-align: left;"><span style="float: none;">Allowed DJ\'s:</span><ul id="djs"></ul></div>');
      settings.find('div.spots').first().append('<div><span>Boot Message:</span></div>');
      settings.find('div.spots').first().append('<div><textarea id="boot_msg" cols="30" rows="3" style="font-size: 18px;">' + window.izzmo.spotSaving.boot_msg + '</textarea></div>');
      
      var users = [];
      $.each(window.izzmo.ttObj.users, function(i, v) {
        users.push(v.name);
      });
      settings.find('input#user').autocomplete({
        source: users
      })
      .bind('keypress', function(e) {
        if(e.keyCode == 13 && $.inArray(this.value, window.izzmo.spotSaving.spot_users) < 0) {
          var html = $('<li><span id="name">' + this.value.toLowerCase() + '</span> <a href="#" title="Remove Person"><img src="http://www.pinnacleofdestruction.net/tt/images/x.gif" alt="Remove Person" /></a></li>');
          html.find('a').bind('click', function(e) {
            e.preventDefault();
            var container = $(this).parent();
            delete window.izzmo.spotSaving.spot_users[$.inArray(container.find('span#name').html(), window.izzmo.spotSaving.spot_users)];
            container.remove();
          });
          window.izzmo.spotSaving.spot_users.push(this.value.toLowerCase());
          settings.find('ul#djs').append(html);
          this.value = "";
        }
      });
      $.each(window.izzmo.spotSaving.spot_users, function(i, v) {
        if(v == undefined) {
          delete window.izzmo.spotSaving.spot_users[i];
          return;
        }
        var html = $('<li><span id="name">' + v.toLowerCase() + '</span> <a href="#" title="Remove Person"><img src="http://www.pinnacleofdestruction.net/tt/images/x.gif" alt="Remove Person" /></a></li>');
          html.find('a').bind('click', function(e) {
            e.preventDefault();
            var container = $(this).parent();
            delete window.izzmo.spotSaving.spot_users[$.inArray(container.find('span#name').html(), window.izzmo.spotSaving.spot_users)];
            container.remove();
          });
          settings.find('ul#djs').append(html);
          this.value = "";
      });
      
      util.showOverlay(settings);
      });
    }
    
    // setup buddy list enhancements
    window.BuddyListPM.layouts.buddyListBuddy = window.izzmo.ui.buddyListBuddy;
    //window.turntable.buddyList._updateBuddies = window.turntable.buddyList.updateBuddies;
    window.turntable.buddyList.updateBuddies = function(f) {
      if (f.success == true) {
        $(this.nodes.buddyList).empty();
        var a = [],
            favs = [],
            e = {};
        if (f.rooms && f.rooms.length) {
          for (var g = 0, l = f.rooms.length; g < l; g++) {
            var c = f.rooms[g];
            if (c.length && c[1].length) {
              for (var d = 0, n = c[1].length; d < n; d++) {
                var b = c[1][d];
                b.roomName = c[0].name;
                b.roomShortcut = c[0].shortcut;
                b.roomId = c[0].roomid;
                ($.inArray(b.userid, window.izzmo.ui.settings.favorites) >= 0) ? favs.push(b) : a.push(b);
                e[b.userid] = b;
              }
            }
          }
          this.onlineBuddies = {};
          a = util.alphabetize(a, "name");
          favs = util.alphabetize(favs, "name");
          a = favs.concat(a);
          for (var g = 0, l = a.length; g < l; g++)
            this.addBuddy(a[g]);
        }
        else
          $(this.nodes.buddyList).append(util.buildTree(BuddyListPM.layouts.noBuddies));
          
        for (var g in this.pmWindows) {
          var k = this.pmWindows[g].otherUserId;
          if (k in e)
            this.pmWindows[g].updateStatus(e[k].status, false);
          else {
            var m = (turntable.user.fanOf.indexOf(k) >= 0);
            var h = (turntable.user.buddies.indexOf(k) >= 0);
            if (m || h)
              this.pmWindows[g].updateStatus("offline", false);
          }
        }
      }
      //window.turntable.buddyList._updateBuddies(f);
    }
    window.turntable.fetchBuddyPresence();
    
    // add settings button to menu
    $('#izzmo-settings-menu-settings').remove();
    $('#menuh').find('div.menuItem').last().before('<div id="izzmo-settings-menu-settings" class="menuItem">TTEnhanced</div>');
    $('#izzmo-settings-menu-settings').bind('click', function() {
      var settings = $(util.buildTree(
        ["div#izzui-settings.settingsOverlay.modal", {},
          ["div.close-x", { event: { click: util.hideOverlay } }],
          ["h1", "Izzmo's UI Settings"],
          ["br"],
          ["div.fields", {} ],
          ["div.save-changes.centered-button", { event: {
            click: function() {
              var type = -1;
              $('#izzui-settings input.displaytype').each(function(i) {
                if(this.checked) {
                  type = i-1;
                  return false;
                }
              });
              window.izzmo.ui.settings.notifications = ($('#izzui-settings input.notifications')[1].checked);
              window.izzmo.ui.settings.showChatAvatarTooltip = ($('#izzui-settings input.avatar_tooltip')[1].checked);

              if(type != window.izzmo.ui.settings.displayType)
                window.izzmo.ui.setDisplay(type, true);
              window.izzmo.ui.settings.displayType = type;
              
              window.izzmo.eventManager.queue({api: 'settings', code: 'set', settings: window.izzmo.ui.settings});
              util.hideOverlay();
            }
          } }],
          ["br"]
        ]
      ));
      settings.find('div.fields').first().append('<div><span>Desktop Notifications</span><div><input type="radio" name="notifications" class="notifications" value="0" ' + ((window.izzmo.ui.settings.notifications) ? '' : 'checked') + '> No <input type="radio" name="notifications" class="notifications" value="1"' + ((window.izzmo.ui.settings.notifications) ? 'checked' : '') + '> Yes</div></div>');
      settings.find('div.fields').first().append('<div><span>Avatar Tooltip</span><div><input type="radio" name="avatar_tooltip" class="avatar_tooltip" value="0" ' + ((window.izzmo.ui.settings.showChatAvatarTooltip) ? '' : 'checked') + '> No <input type="radio" name="avatar_tooltip" class="avatar_tooltip" value="1" ' + ((window.izzmo.ui.settings.showChatAvatarTooltip) ? 'checked' : '') + '> Yes</div><p>Will show a bubble over the users avatar in the crowd if you click on their username in the chat window (if animations are on).</p></div>');
      settings.find('div.fields').first().append('<div><span>Display</span><div>Turntable Default <input type="radio" name="displaytype" class="displaytype" value="-1" ' + ((window.izzmo.ui.settings.displayType != -1) ? '' : 'checked') + '><br />3-columns <input type="radio" name="displaytype" class="displaytype" value="0" ' + ((window.izzmo.ui.settings.displayType != 0) ? '' : 'checked') + '><br />Queue & Guest List Stacked <input type="radio" name="displaytype" class="displaytype" value="1" ' + ((window.izzmo.ui.settings.displayType != 1) ? '' : 'checked') + '><br />Queue & Chat Stacked <input type="radio" name="displaytype" class="displaytype" value="2" ' + ((window.izzmo.ui.settings.displayType != 2) ? '' : 'checked') + '><br /></div></div>');
      settings.find('div.fields').first().append('<div><span>Notification Keywords:</span><div><input type="text" id="chat-keywords" style="width: 125px; font-size: 18px;" /></div><p>If you would like to receive notifications for keywords other than your own username, you can enter them here.</p></div>');
      settings.find('div.fields').first().append('<div style="padding: 5px; font-size: 15px; text-align: left;"><span style="float: none;"><ul id="keywords"></ul></div>');
      
      settings.find('input#chat-keywords').bind('keypress', function(e) {
        if(e.keyCode == 13 && $.inArray(this.value, window.izzmo.ui.settings.notifierKeywords) < 0) {
          var html = $('<li><span id="name">' + this.value.toLowerCase() + '</span> <a href="#" title="Remove Keyword"><img src="http://www.pinnacleofdestruction.net/tt/images/x.gif" alt="Remove Keyword" /></a></li>');
          html.find('a').bind('click', function(e) {
            e.preventDefault();
            var container = $(this).parent(), keyword = container.find('span#name').html();
            window.izzmo.ui.settings.notifierKeywords.splice($.inArray(keyword, window.izzmo.ui.settings.notifierKeywords), 1);
            window.izzmo.eventManager.queue({api: 'notifierKeywords.remove', 'keyword': this.value.toLowerCase() });
            container.remove();
          });
          window.izzmo.ui.settings.notifierKeywords.push(this.value.toLowerCase());
          window.izzmo.eventManager.queue({api: 'notifierKeywords.add', keyword: this.value.toLowerCase() });
          settings.find('ul#keywords').append(html);
          this.value = "";
        }
      });
      
      $.each(window.izzmo.ui.settings.notifierKeywords, function(i, v) {
        if(v == undefined) {
          delete window.izzmo.ui.settings.notifierKeywords[i];
          return;
        }
        var html = $('<li><span id="name">' + v.toLowerCase() + '</span> <a href="#" title="Remove Keyword"><img src="http://www.pinnacleofdestruction.net/tt/images/x.gif" alt="Remove Keyword" /></a></li>');
          html.find('a').bind('click', function(e) {
            e.preventDefault();
            var container = $(this).parent();
            window.izzmo.ui.settings.notifierKeywords.splice($.inArray(keyword, window.izzmo.ui.settings.notifierKeywords), 1);
            container.remove();
          });
          settings.find('ul#keywords').append(html);
          this.value = "";
      });
      
      util.showOverlay(settings);
    });
    
    // get settings from extension
    window.izzmo.eventManager.queue({api: 'settings', code: 'get'}, function(response) {
      // check if want notifications
      window.izzmo.ui.settings = $.extend(window.izzmo.ui.settings, response.settings);
      if(response.settings.notifications == -1 && window.webkitNotifications.checkPermission() == 1) {
        util.showOverlay(util.buildTree([
            "div.modal", {}, ["div.close-x",
            {
                event: {
                    click: util.hideOverlay
                }
            }], ["h1", "Add Chat Notifications"], ["br"], ["div.field",
            {}, "Would you like chat notifications to appear when someone says your name or private messages you?", ["br"]], ["div.ok-button.centered-button",
            {
                event: {
                    click: function() {
                      window.webkitNotifications.requestPermission();
                      window.izzmo.eventManager.queue({api: 'settings', code: 'set', settings: {notifications: 1}});
                      window.izzmo.ui.settings = 1;
                      util.hideOverlay();
                    }
                }
            }], ["p.cancel.no-thanks",
            {
                event: {
                    click: function() {
                      util.hideOverlay();
                      window.izzmo.eventManager.queue({api: 'settings', code: 'set', settings: {notifications: 0}});
                      window.izzmo.ui.settings = 0;
                    }
                },
                style: {
                    "padding-top": "10px"
                }
            }, "No"]]
        ));
      }
      if(!window.izzmo.ui.settings.animations)
        window.izzmo.ui.setAnimations(false);
      
      // update UI if necessary
      window.izzmo.ui.setDisplay(window.izzmo.ui.settings.displayType, false);
      
      // setup new version notifier
      if(window.izzmo.ui.version !== window.izzmo.ui.settings.currentVersion) {
        window.izzmo.eventManager.queue({api: 'set_version', version: window.izzmo.ui.version});
        var html = $(util.buildTree(
          ["div.modal", {},
            ["div.close-x", {event: { click: util.hideOverlay } }],
            ["h1", "New Version " + window.izzmo.ui.version + "!"],
            ["br"],
            ["div.field", {}, ''],
            ["div.ok-button.centered-button", { event: { click: util.hideOverlay } } ]
          ]
        ));
        html.find('div.field').html("See what's new in this version: <br /><br />" + window.izzmo.ui.newUpdatesMsg);
        util.showOverlay(html);
      }
    });
  }
  
  $(document).ready(function() {
    var wait = 0,
    roomCheck = setInterval(function() {
      wait++;
      if($($('#turntable').find('div.roomView > div')[1]).height() > 0) {
        window.izzmo.ui.init();
        clearInterval(roomCheck);
      }
      else if(wait > 10)
        clearInterval(roomCheck);
    }, 1000);
  });
})();
$(window).blur(function(){$('html').addClass('blur').removeClass('active');}).focus(function(){$('html').removeClass('blur').addClass('active');});
